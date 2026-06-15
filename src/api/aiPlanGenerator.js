import { EXERCISES } from "../data/exercises";
import { ANTHROPIC_API_KEY } from "../config";

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

  const repRule =
    goal === "Strength"      ? "3–5 reps, high weight"
    : goal === "Muscle Gain" ? "8–12 reps, moderate-heavy weight"
    : goal === "Fat Loss"    ? "12–20 reps, shorter rest"
    :                          "8–12 reps";

  const volumeRule =
    expLevel === "Beginner"     ? "4–5 exercises per session, compound-focused, no redundancy"
    : expLevel === "Advanced"   ? "6–8 exercises per session, include isolation work"
    :                             "5–7 exercises per session, mix compound and isolation";

  const splitRule =
    daysPerWeek <= 3
      ? `${daysPerWeek} full-body sessions labelled A/B/C. Each hits chest, back, legs, shoulders, core.`
      : daysPerWeek === 4
      ? "4 sessions: Upper A, Lower A, Upper B, Lower B."
      : `${daysPerWeek} sessions: Push (chest/shoulders/triceps), Pull (back/biceps), Legs (quads/hamstrings/glutes/core)${daysPerWeek >= 5 ? ", then repeat sequence for remaining days" : ""}.`;

  const cardioRule = goal === "Fat Loss" ? "Add 1 cardio exercise per session (e.g. Treadmill Run, Jump Rope)." : "";

  const prompt = `You are an elite personal trainer. Output ONLY valid JSON — no markdown, no prose.

Create a ${daysPerWeek}-day/week ${split} workout plan.
Client: ${expLevel} · ${actLevel} activity · Goals: ${aims.join(", ") || "General Fitness"} · Equipment: ${equipment}

AVAILABLE EXERCISES (use ONLY exact names):
${menu}

Split structure: ${splitRule}
Volume: ${volumeRule}
Reps: ${repRule}
${cardioRule}

Return this JSON (no extra fields):
{
  "name": "short catchy plan name",
  "goal": "${goal}",
  "description": "one personalised sentence max 120 chars",
  "sessions": [
    {
      "title": "Session title",
      "exercises": [{ "name": "exact name", "sets": 4, "reps": "8-10" }]
    }
  ]
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) throw new Error("Invalid API key — update ANTHROPIC_API_KEY in src/config.js");
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 120)}`);
  }

  const data = await res.json();
  const text = (data.content?.[0]?.text || "").trim();

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
