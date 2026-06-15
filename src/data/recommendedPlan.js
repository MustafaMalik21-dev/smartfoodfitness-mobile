import { EXERCISES } from "./exercises";

const DIFF_SCORE = { Beginner: 0, Intermediate: 1, Advanced: 2 };

// Pick `count` exercises from a category, sorted by difficulty closeness.
// `offset` shifts the starting index to give variety across sessions.
function pick(category, count, diff, offset = 0) {
  const pref = DIFF_SCORE[diff] ?? 0;
  const pool = [...EXERCISES.filter((e) => e.category === category)].sort(
    (a, b) =>
      Math.abs((DIFF_SCORE[a.difficulty] ?? 1) - pref) -
      Math.abs((DIFF_SCORE[b.difficulty] ?? 1) - pref)
  );
  if (pool.length === 0) return [];
  const result = [];
  const seen = new Set();
  for (let i = 0; i < pool.length && result.length < count; i++) {
    const e = pool[(offset + i) % pool.length];
    if (!seen.has(e.id)) { seen.add(e.id); result.push(e); }
  }
  return result;
}

function mkEx(exercise, sets, reps) {
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    category: exercise.category,
    equipment: exercise.equipment,
    notes: exercise.instructions?.[0] || "",
    sets,
    reps: String(reps),
    weight: "",
  };
}

function fullBodySession(label, diff, sets, reps, addCardio, offset) {
  return {
    title: `Full Body ${label}`,
    weekdays: [],
    exercises: [
      ...pick("Legs",      2, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...pick("Chest",     1, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...pick("Back",      2, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...pick("Shoulders", 1, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...pick("Core",      1, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...(addCardio ? pick("Cardio", 1, diff, 0).map((e) => mkEx(e, 1, "20")) : []),
    ],
  };
}

function upperSession(label, diff, sets, reps, offset) {
  return {
    title: label ? `Upper Body ${label}` : "Upper Body",
    weekdays: [],
    exercises: [
      ...pick("Chest",     2, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...pick("Back",      2, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...pick("Shoulders", 1, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...pick("Biceps",    1, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...pick("Triceps",   1, diff, offset).map((e) => mkEx(e, sets, reps)),
    ],
  };
}

function lowerSession(label, diff, sets, reps, addCardio, offset) {
  return {
    title: label ? `Lower Body ${label}` : "Lower Body",
    weekdays: [],
    exercises: [
      ...pick("Legs", 4, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...pick("Core", 2, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...(addCardio ? pick("Cardio", 1, diff, 0).map((e) => mkEx(e, 1, "20")) : []),
    ],
  };
}

function pushSession(label, diff, sets, reps, offset) {
  return {
    title: label ? `Push ${label}` : "Push",
    weekdays: [],
    exercises: [
      ...pick("Chest",     3, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...pick("Shoulders", 2, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...pick("Triceps",   2, diff, offset).map((e) => mkEx(e, sets, reps)),
    ],
  };
}

function pullSession(label, diff, sets, reps, offset) {
  return {
    title: label ? `Pull ${label}` : "Pull",
    weekdays: [],
    exercises: [
      ...pick("Back",   4, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...pick("Biceps", 2, diff, offset).map((e) => mkEx(e, sets, reps)),
    ],
  };
}

function legsSession(label, diff, sets, reps, addCardio, offset) {
  return {
    title: label ? `Legs ${label}` : "Legs",
    weekdays: [],
    exercises: [
      ...pick("Legs", 5, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...pick("Core", 1, diff, offset).map((e) => mkEx(e, sets, reps)),
      ...(addCardio ? pick("Cardio", 1, diff, 0).map((e) => mkEx(e, 1, "20")) : []),
    ],
  };
}

function buildSessions(days, diff, sets, reps, addCardio) {
  if (days <= 3) {
    return Array.from({ length: days }, (_, i) =>
      fullBodySession(["A", "B", "C"][i], diff, sets, reps, addCardio, i * 4)
    );
  }
  if (days === 4) {
    return [
      upperSession("A", diff, sets, reps, 0),
      lowerSession("A", diff, sets, reps, addCardio, 0),
      upperSession("B", diff, sets, reps, 5),
      lowerSession("B", diff, sets, reps, addCardio, 5),
    ];
  }
  // 5–6 days: PPL base + extras
  const sessions = [
    pushSession("",  diff, sets, reps, 0),
    pullSession("",  diff, sets, reps, 0),
    legsSession("",  diff, sets, reps, addCardio, 0),
    upperSession("", diff, sets, reps, 6),
  ];
  if (days >= 5) sessions.push(lowerSession("B", diff, sets, reps, addCardio, 6));
  if (days >= 6) sessions.push(pushSession("B", diff, sets, reps, 6));
  return sessions;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateRecommendedPlan(profile, userId) {
  const expLevel  = profile?.experienceLevel || "Beginner";
  const actLevel  = profile?.activityLevel   || "";
  const aims      = Array.isArray(profile?.aims) ? profile.aims : [];

  // Determine primary workout goal from aims
  let goal    = "General Fitness";
  let goalKey = "general";
  const MUSCLE_AIMS = ["Gain Muscle", "Build Mass", "Muscle Definition", "Improve Symmetry", "Hit Protein Goal", "Track Macros", "Balanced Macros"];
  const STRENGTH_AIMS = ["Build Strength", "Increase 1RM", "Improve Power", "Deadlift Goal", "Squat Goal", "Bench Press Goal"];
  const FAT_LOSS_AIMS = ["Lose Weight", "Lose Body Fat", "Get Toned", "Reduce Waist", "Get Fitter", "Run a 5K", "Run a 10K", "Increase Steps", "Improve Endurance", "Cycle Regularly"];
  if (aims.some((a) => STRENGTH_AIMS.includes(a))) {
    goal = "Strength"; goalKey = "strength";
  } else if (aims.some((a) => MUSCLE_AIMS.includes(a))) {
    goal = "Muscle Gain"; goalKey = "muscle";
  } else if (aims.some((a) => FAT_LOSS_AIMS.includes(a))) {
    goal = "Fat Loss"; goalKey = "fat_loss";
  }

  // Days per week: base from experience, adjusted by activity
  let days = expLevel === "Advanced" ? 5 : expLevel === "Intermediate" ? 4 : 3;
  if (actLevel === "High")     days = Math.min(6, days + 1);
  if (actLevel === "Low")      days = Math.max(2, days - 1);

  // Sets/reps per goal
  const { sets, reps } = {
    strength: { sets: 5, reps: "5"  },
    muscle:   { sets: 4, reps: "10" },
    fat_loss: { sets: 3, reps: "15" },
    general:  { sets: 3, reps: "12" },
  }[goalKey];

  const addCardio = goalKey === "fat_loss";
  const splitName = days <= 3 ? "Full Body" : days === 4 ? "Upper / Lower" : "Push / Pull / Legs";

  const sessions = buildSessions(days, expLevel, sets, reps, addCardio);

  return {
    id: `custom_rec_${userId || "guest"}`,
    name: `Your ${goal} Plan`,
    level: expLevel,
    goal,
    daysPerWeek: days,
    description: `A personalised ${days}-day ${splitName} split built for ${expLevel.toLowerCase()} level${actLevel ? ` · ${actLevel} activity` : ""}.`,
    sessions,
    isRecommended: true,
  };
}

// Returns a human-readable breakdown of why the plan was generated this way
export function getPlanRationale(profile) {
  const expLevel = profile?.experienceLevel || "";
  const actLevel = profile?.activityLevel   || "";
  const aims     = Array.isArray(profile?.aims) ? profile.aims : [];

  const lines = [];
  if (expLevel) lines.push(`${expLevel} experience → ${expLevel === "Beginner" ? "3" : expLevel === "Intermediate" ? "4" : "5"}-day base split`);
  if (actLevel === "High")   lines.push("High activity → +1 training day");
  if (actLevel === "Low")    lines.push("Low activity → −1 training day");
  if (actLevel === "Moderate") lines.push("Moderate activity → standard volume");

  const fitnessAims = aims.filter((a) =>
    ["Gain Muscle","Build Mass","Build Strength","Increase 1RM","Lose Weight","Lose Body Fat","Get Fitter","Run a 5K","Run a 10K","Increase Steps","Hit Protein Goal","Get Toned"].includes(a)
  );
  if (fitnessAims.length) lines.push(`Goals: ${fitnessAims.slice(0, 3).join(", ")}`);

  return lines;
}
