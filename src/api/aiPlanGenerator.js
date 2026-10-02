import { EXERCISES } from "../data/exercises";
import apiClient from "./apiClient";

const EQUIPMENT_MAP = {
  "Full Gym": null,
  "Barbell & Dumbbells": ["Barbell", "Dumbbells", "EZ Bar", "Bodyweight"],
  "Dumbbells Only": ["Dumbbells", "Bodyweight"],
  "Bodyweight Only": ["Bodyweight"],
};

function filterExercises(equipment) {
  const allowed = EQUIPMENT_MAP[equipment];
  if (!allowed) return EXERCISES;
  return EXERCISES.filter((e) => allowed.includes(e.equipment));
}

function buildExerciseMenu(exercises) {
  const byCategory = {};
  for (const ex of exercises) {
    if (!byCategory[ex.category]) byCategory[ex.category] = [];
    byCategory[ex.category].push(ex.name);
  }
  return Object.entries(byCategory)
    .map(([cat, names]) => `${cat}: ${names.join(" | ")}`)
    .join("\n");
}

function lookupExercise(name) {
  const lower = (name || "").toLowerCase().trim();
  return (
    EXERCISES.find((e) => e.name.toLowerCase() === lower) ||
    EXERCISES.find(
      (e) =>
        e.name.toLowerCase().includes(lower) ||
        lower.includes(e.name.toLowerCase())
    )
  );
}

function mapToEntry(aiEx) {
  const ex = lookupExercise(aiEx.name);
  if (!ex) return null;
  return {
    exerciseId: ex.id,
    name: ex.name,
    category: ex.category,
    equipment: ex.equipment,
    notes: ex.instructions?.[0] || "",
    sets: typeof aiEx.sets === "number" ? aiEx.sets : 3,
    reps: String(aiEx.reps ?? "10"),
    weight: "",
  };
}

function deriveGoal(aims) {
  const a = aims || [];
  if (a.some((x) => ["Build Strength", "Increase 1RM", "Improve Power", "Deadlift Goal", "Squat Goal", "Bench Press Goal"].includes(x)))
    return "Strength";
  if (a.some((x) => ["Gain Muscle", "Build Mass", "Muscle Definition", "Improve Symmetry", "Hit Protein Goal", "Track Macros"].includes(x)))
    return "Muscle Gain";
  if (a.some((x) => ["Lose Weight", "Lose Body Fat", "Get Toned", "Reduce Waist", "Get Fitter", "Improve Endurance", "Run a 5K", "Run a 10K"].includes(x)))
    return "Fat Loss";
  return "General Fitness";
}

export async function generateAIPlan(profile, answers) {
  const { daysPerWeek, equipment } = answers;
  const expLevel = profile?.experienceLevel || "Beginner";
  const actLevel = profile?.activityLevel || "Moderate";
  const aims = Array.isArray(profile?.aims) ? profile.aims.slice(0, 6) : [];
  const goal = deriveGoal(aims);

  const available = filterExercises(equipment);
  const menu = buildExerciseMenu(available);

  const split =
    daysPerWeek <= 3 ? "Full Body" : daysPerWeek === 4 ? "Upper/Lower" : "Push/Pull/Legs";

  // The backend assembles the prompt and calls Anthropic with its server-held
  // key — the mobile bundle must never contain API credentials.
  // Generating a plan can take most of the backend's own budget (8s connect +
  // 60s read), so this call has to outlast it; the shared 15s default would
  // abort a request the server is still answering.
  const res = await apiClient.post("/api/ai/generate-plan", {
    daysPerWeek,
    equipment,
    experienceLevel: expLevel,
    activityLevel: actLevel,
    aims,
    exerciseMenu: menu,
  }, { timeout: 70000 });

  const text = (res.data?.text || "").trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse AI response as JSON");
    parsed = JSON.parse(match[0]);
  }

  const sessions = (parsed.sessions || []).map((sess) => ({
    title: sess.title || "Session",
    weekdays: [],
    exercises: (sess.exercises || []).map(mapToEntry).filter(Boolean),
  }));

  return {
    id: `custom_ai_${Date.now()}`,
    name: parsed.name || `Your ${goal} Plan`,
    level: expLevel,
    goal: parsed.goal || goal,
    daysPerWeek,
    description: parsed.description || `A personalised ${daysPerWeek}-day ${split} plan for ${expLevel.toLowerCase()} level.`,
    sessions,
    isRecommended: true,
    isAIGenerated: true,
    generatedAt: new Date().toISOString(),
  };
}
