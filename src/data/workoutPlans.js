import { EXERCISES } from "./exercises";

export const LOCAL_PLAN_PREFIX = "local_";
export const CUSTOM_PLAN_KEY = "sff_custom_plans";

function customPlanKey(userId) {
  return userId ? `sff_custom_plans_${userId}` : CUSTOM_PLAN_KEY;
}

export function isLocalPlan(planId) {
  const id = String(planId || "");
  return id.startsWith(LOCAL_PLAN_PREFIX) || id.startsWith("custom_") || id.startsWith("ai_rec_");
}

export function getLocalPlanId(slug) {
  return `${LOCAL_PLAN_PREFIX}${slug}`;
}

function ex(id, sets = 3, reps = "10") {
  const found = EXERCISES.find((e) => e.id === id);
  if (!found) return null;
  return {
    exerciseId: id,
    name: found.name,
    category: found.category,
    equipment: found.equipment,
    notes: found.instructions[0] || "",
    sets,
    reps: String(reps),
  };
}

function ses(title, exerciseIds, setsRepsOverrides = {}) {
  return {
    title,
    exercises: exerciseIds
      .map((id) => {
        const override = setsRepsOverrides[id] || {};
        return ex(id, override.sets ?? 3, override.reps ?? "10");
      })
      .filter(Boolean),
  };
}

// ─── Correct exercise ID reference ────────────────────────────────────────────
// Back:    ba01 Pull-Up, ba02 BB Row, ba03 Cable Row, ba04 Lat Pulldown,
//          ba05 1-Arm Row, ba06 Deadlift, ba07 T-Bar Row, ba08 Face Pull,
//          ba09 Straight-Arm PD, ba10 Chin-Up, bk11-bk14 (extra)
// Legs:    le01 BB Squat, le02 Leg Press, le03 RDL, le04 Lunges, le05 Leg Ext,
//          le06 Leg Curl, le07 Hip Thrust, le08 Calf Raise, le09 Bulg Split Squat,
//          le10 Goblet Squat, lg11-lg14 (extra)
// Chest:   ch01-ch10 + ch11-ch14 (extra)
// Shldrs:  sh01-sh08 + sh09-sh12 (extra)
// Arms:    ar01-ar10 + ar11-ar14 (extra)
// Core:    co01-co08 + co09-co12 (extra)
// Cardio:  ca01-ca06 + ca07-ca10 (extra)
// ──────────────────────────────────────────────────────────────────────────────

export const LOCAL_PLANS = [
  // ─── BEGINNER ────────────────────────────────────────────────────────────────
  {
    id: getLocalPlanId("full_body_beginner"),
    name: "Full Body Beginner",
    level: "Beginner",
    goal: "General Fitness",
    daysPerWeek: 3,
    description: "Three full-body sessions per week using compound movements. Perfect for building a solid foundation with no prior experience needed.",
    sessions: [
      ses("Full Body A", ["ch02", "ba04", "le01", "sh02", "ar09", "co01"],
        { le01: { sets: 3, reps: "8" }, ch02: { sets: 3, reps: "8" } }),
      ses("Full Body B", ["ch07", "ba05", "le02", "sh03", "ar10", "co02"]),
      ses("Full Body C", ["ch04", "ba03", "le04", "sh04", "ar07", "co04"]),
    ],
  },
  {
    id: getLocalPlanId("home_bodyweight"),
    name: "Home Bodyweight",
    level: "Beginner",
    goal: "General Fitness",
    daysPerWeek: 3,
    description: "No equipment needed. Progressive bodyweight exercises you can do anywhere — at home, in a hotel, or in the park.",
    sessions: [
      ses("Upper Body",       ["ch07", "ch04", "ar09", "sh06", "ar10", "co01"]),
      ses("Lower Body",       ["le02", "le04", "le07", "lg12", "co03", "co07"]),
      ses("Full Body Cardio", ["ca05", "ca10", "co04", "ch07", "le04", "co02"]),
    ],
  },
  {
    id: getLocalPlanId("beginner_strength"),
    name: "Beginner Strength",
    level: "Beginner",
    goal: "Strength",
    daysPerWeek: 3,
    description: "Three compound-focused sessions per week. Low reps, progressive overload — the smartest way to build foundational strength fast.",
    sessions: [
      ses("Squat & Push", ["le01", "ch01", "sh01", "ar09", "co01"],
        { le01: { sets: 4, reps: "5" }, ch01: { sets: 4, reps: "5" }, sh01: { sets: 3, reps: "6" } }),
      ses("Hinge & Pull", ["ba06", "ba04", "le04", "ar01", "co02"],
        { ba06: { sets: 4, reps: "5" } }),
      ses("Full Body Power", ["le01", "ch02", "ba05", "sh02", "co04"],
        { le01: { sets: 3, reps: "6" }, ch02: { sets: 3, reps: "8" } }),
    ],
  },
  {
    id: getLocalPlanId("beginner_gains"),
    name: "Beginner Gains",
    level: "Beginner",
    goal: "Muscle Gain",
    daysPerWeek: 3,
    description: "3-day full-body programme focused on hypertrophy. Moderate weight, higher reps, and enough volume to spark muscle growth from day one.",
    sessions: [
      ses("Upper Body", ["ch02", "ch04", "ba04", "sh02", "sh03", "ar09"],
        { ch02: { sets: 3, reps: "10" }, ba04: { sets: 3, reps: "10" } }),
      ses("Lower Body", ["le01", "le02", "le04", "le07", "co02", "co04"],
        { le01: { sets: 3, reps: "10" } }),
      ses("Full Body + Arms", ["ch07", "ba05", "le10", "ar01", "ar10", "co01"]),
    ],
  },
  {
    id: getLocalPlanId("fat_burn_circuit"),
    name: "Fat Burn Circuit",
    level: "Beginner",
    goal: "Fat Loss",
    daysPerWeek: 4,
    description: "Circuits mixing compound lifts with cardio bursts. High intensity, short rest periods — maximum calorie burn without hours in the gym.",
    sessions: [
      ses("Circuit A — Upper",    ["ch02", "ba04", "sh02", "ar09", "ca05", "ca07"],
        { ca05: { sets: 4, reps: "15" } }),
      ses("Circuit B — Lower",    ["le02", "le04", "lg12", "co04", "ca10", "ca03"]),
      ses("Circuit C — Full Body", ["ch07", "ba05", "le01", "sh04", "co02", "ca05"]),
      ses("Cardio & Core",        ["ca08", "ca07", "co09", "co11", "co10", "co12"]),
    ],
  },

  // ─── INTERMEDIATE ────────────────────────────────────────────────────────────
  {
    id: getLocalPlanId("push_pull_legs"),
    name: "Push / Pull / Legs",
    level: "Intermediate",
    goal: "Muscle Gain",
    daysPerWeek: 6,
    description: "The classic 6-day split — push muscles, pull muscles, and legs each trained twice per week for maximum hypertrophy volume.",
    sessions: [
      ses("Push A — Chest & Shoulders", ["ch01", "ch03", "sh01", "sh03", "sh05", "ar08"],
        { ch01: { sets: 4, reps: "6" }, sh01: { sets: 4, reps: "8" } }),
      ses("Pull A — Back & Biceps",     ["ba01", "ba03", "ba05", "ar01", "ar03", "ar05"]),
      ses("Legs A",                     ["le01", "le03", "le05", "le07", "co01", "co03"],
        { le01: { sets: 4, reps: "6" } }),
      ses("Push B — Chest & Triceps",   ["ch02", "ch11", "ch12", "ar07", "ar08", "ar13"]),
      ses("Pull B — Back & Rear Delts", ["ba02", "bk12", "ba04", "sh10", "ar11", "ar12"]),
      ses("Legs B",                     ["le02", "le04", "le06", "le08", "co02", "co04"]),
    ],
  },
  {
    id: getLocalPlanId("upper_lower"),
    name: "Upper / Lower Split",
    level: "Intermediate",
    goal: "Strength",
    daysPerWeek: 4,
    description: "4 days alternating upper and lower body. A proven structure for building strength and size simultaneously without overtraining.",
    sessions: [
      ses("Upper A — Strength",    ["ch01", "ba01", "sh01", "ar01", "ar07"],
        { ch01: { sets: 4, reps: "5" }, ba01: { sets: 4, reps: "5" }, sh01: { sets: 4, reps: "6" } }),
      ses("Lower A — Strength",    ["le01", "le05", "le03", "co01", "co11"],
        { le01: { sets: 4, reps: "5" } }),
      ses("Upper B — Hypertrophy", ["ch02", "ba02", "sh03", "ch11", "ar02", "ar08"]),
      ses("Lower B — Hypertrophy", ["le02", "le04", "le06", "lg12", "co04", "co02"]),
    ],
  },
  {
    id: getLocalPlanId("strength_foundation"),
    name: "Strength Foundation",
    level: "Intermediate",
    goal: "Strength",
    daysPerWeek: 4,
    description: "Built around the four main compound lifts. Intelligent accessory work fills every gap. Great for raw strength development.",
    sessions: [
      ses("Bench Day",    ["ch01", "ch02", "sh01", "ar13", "ar08", "bk12"],
        { ch01: { sets: 5, reps: "5" } }),
      ses("Squat Day",    ["le01", "le03", "le05", "co01", "co11", "bk13"],
        { le01: { sets: 5, reps: "5" } }),
      ses("Press Day",    ["sh01", "sh09", "sh11", "ch12", "ar07", "ar10"],
        { sh01: { sets: 5, reps: "5" } }),
      ses("Deadlift Day", ["ba06", "ba02", "le03", "lg13", "co10", "bk13"],
        { ba06: { sets: 5, reps: "5" } }),
    ],
  },
  {
    id: getLocalPlanId("shred_strength"),
    name: "Shred & Strength",
    level: "Intermediate",
    goal: "Fat Loss",
    daysPerWeek: 5,
    description: "Strength work paired with conditioning finishers on every session. Retain muscle, burn fat, and stay strong through a cut.",
    sessions: [
      ses("Upper Strength",  ["ch01", "ba01", "sh01", "ar13", "bk12"],
        { ch01: { sets: 4, reps: "6" }, ba01: { sets: 4, reps: "6" } }),
      ses("Lower Strength",  ["le01", "le03", "le07", "co11", "ca03"],
        { le01: { sets: 4, reps: "6" } }),
      ses("Upper Cardio",    ["ca07", "ch05", "sh10", "sh03", "ar10", "co05"]),
      ses("Lower Cardio",    ["ca05", "le04", "le06", "lg12", "co04", "ca10"]),
      ses("HIIT & Core",     ["ca08", "ca10", "co06", "co10", "co12", "co03"]),
    ],
  },
  {
    id: getLocalPlanId("athletic_performance"),
    name: "Athletic Performance",
    level: "Intermediate",
    goal: "General Fitness",
    daysPerWeek: 4,
    description: "A balanced mix of strength, endurance, and conditioning. Built for real-world performance and overall athleticism.",
    sessions: [
      ses("Strength A",        ["le01", "ch01", "ba01", "sh01", "co01"],
        { le01: { sets: 4, reps: "5" }, ch01: { sets: 4, reps: "5" } }),
      ses("Conditioning",      ["ca05", "ca07", "ca10", "co11", "co04", "co03"]),
      ses("Strength B",        ["ba06", "ch02", "ba04", "sh03", "ar07", "co02"],
        { ba06: { sets: 4, reps: "5" } }),
      ses("Cardio & Mobility", ["ca02", "ca04", "sh05", "co05", "sh10", "co10"]),
    ],
  },

  // ─── ADVANCED ────────────────────────────────────────────────────────────────
  {
    id: getLocalPlanId("hypertrophy_max"),
    name: "Hypertrophy Max",
    level: "Advanced",
    goal: "Muscle Gain",
    daysPerWeek: 5,
    description: "High-volume, high-frequency training across 5 days. Each muscle group hit twice per week for maximum hypertrophy stimulus.",
    sessions: [
      ses("Chest & Triceps",  ["ch01", "ch03", "ch11", "ch08", "ar08", "ar13"],
        { ch01: { sets: 5, reps: "8" }, ar08: { sets: 4, reps: "10" } }),
      ses("Back & Biceps",    ["ba01", "ba02", "ba04", "bk11", "ar01", "ar11"],
        { ba01: { sets: 5, reps: "6" }, ba02: { sets: 5, reps: "8" } }),
      ses("Legs & Glutes",    ["le01", "le03", "le07", "le05", "co11", "le08"],
        { le01: { sets: 5, reps: "6" }, le07: { sets: 4, reps: "10" } }),
      ses("Shoulders & Arms", ["sh01", "sh03", "sh12", "sh09", "ar11", "ar10"],
        { sh01: { sets: 5, reps: "5" }, sh03: { sets: 4, reps: "15" } }),
      ses("Arms & Core",      ["ar01", "ar05", "ar07", "ar13", "co06", "co12"]),
    ],
  },
  {
    id: getLocalPlanId("powerlifting_base"),
    name: "Powerlifting Base",
    level: "Advanced",
    goal: "Strength",
    daysPerWeek: 4,
    description: "Built around the squat, bench, and deadlift. Heavy triples and fives with intelligent accessory work to build elite-level strength.",
    sessions: [
      ses("Squat Focus",    ["le01", "le09", "le05", "co11", "bk13"],
        { le01: { sets: 5, reps: "3" }, le09: { sets: 4, reps: "6" } }),
      ses("Bench Focus",    ["ch01", "ch03", "ar13", "ar08", "bk12"],
        { ch01: { sets: 5, reps: "3" }, ar13: { sets: 4, reps: "6" } }),
      ses("Deadlift Focus", ["ba06", "ba02", "le03", "bk14", "co08"],
        { ba06: { sets: 5, reps: "3" }, le03: { sets: 4, reps: "6" } }),
      ses("Press & Rows",   ["sh01", "ba01", "sh09", "sh10", "co11"],
        { sh01: { sets: 5, reps: "3" }, ba01: { sets: 5, reps: "5" } }),
    ],
  },
  {
    id: getLocalPlanId("advanced_cut"),
    name: "Advanced Cut",
    level: "Advanced",
    goal: "Fat Loss",
    daysPerWeek: 5,
    description: "Heavy strength with intense conditioning. Built to retain every pound of muscle while torching body fat across 5 tough sessions.",
    sessions: [
      ses("Upper Power",      ["ch01", "ba01", "sh01", "ar13", "ca07"],
        { ch01: { sets: 4, reps: "5" }, ba01: { sets: 4, reps: "5" } }),
      ses("Lower Power",      ["le01", "le09", "le07", "co11", "ca08"],
        { le01: { sets: 5, reps: "5" } }),
      ses("HIIT Circuit",     ["ca08", "ca10", "ca05", "ca07", "co06", "co04"]),
      ses("Upper Volume",     ["ch11", "ba04", "sh03", "ar11", "sh10", "co10"]),
      ses("Lower Volume + Core", ["le03", "le06", "lg12", "co12", "co09", "ca03"]),
    ],
  },
  {
    id: getLocalPlanId("advanced_athlete"),
    name: "Advanced Athlete",
    level: "Advanced",
    goal: "General Fitness",
    daysPerWeek: 5,
    description: "A complete athletic programme combining maximal strength, power, conditioning, and mobility. For the serious, well-rounded athlete.",
    sessions: [
      ses("Max Strength",           ["le01", "ch01", "ba06", "sh01"],
        { le01: { sets: 5, reps: "3" }, ch01: { sets: 5, reps: "3" }, ba06: { sets: 4, reps: "3" } }),
      ses("Power & Plyo",           ["ca10", "le09", "ca05", "bk14", "co11", "co08"]),
      ses("Hypertrophy",            ["ch02", "ba02", "sh03", "ar08", "sh12", "ar07"]),
      ses("Conditioning",           ["ca08", "ca04", "ca07", "co06", "co10", "co12"]),
      ses("Recovery & Accessory",   ["sh05", "sh10", "co05", "ba08", "lg12", "co03"]),
    ],
  },
];

export function getLocalPlanById(planId) {
  return LOCAL_PLANS.find((p) => p.id === planId) || null;
}

export function getLocalPlanSessions(planId) {
  const plan = getLocalPlanById(planId);
  return plan ? plan.sessions : [];
}

// Async version that also searches custom plans stored in AsyncStorage
export async function getPlanByIdAsync(planId, userId) {
  if (!planId) return null;
  const local = getLocalPlanById(planId);
  if (local) return local;
  if (String(planId).startsWith("custom_")) {
    try {
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
      const raw = await AsyncStorage.getItem(customPlanKey(userId));
      const customs = raw ? JSON.parse(raw) : [];
      return customs.find((p) => p.id === planId) || null;
    } catch { return null; }
  }
  return null;
}

export async function getCustomPlans(userId) {
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    const raw = await AsyncStorage.getItem(customPlanKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveCustomPlan(plan, userId) {
  const plans = await getCustomPlans(userId);
  const idx = plans.findIndex((p) => p.id === plan.id);
  if (idx >= 0) plans[idx] = plan;
  else plans.push(plan);
  const AsyncStorage = require("@react-native-async-storage/async-storage").default;
  await AsyncStorage.setItem(customPlanKey(userId), JSON.stringify(plans));
}

export async function deleteCustomPlan(planId, userId) {
  const plans = await getCustomPlans(userId);
  const filtered = plans.filter((p) => p.id !== planId);
  const AsyncStorage = require("@react-native-async-storage/async-storage").default;
  await AsyncStorage.setItem(customPlanKey(userId), JSON.stringify(filtered));
}
