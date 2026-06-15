export const AIM_CATEGORIES = [
  {
    key: "bodybuilding",
    label: "Bodybuilding",
    color: "#8b5cf6",
    aims: [
      { key: "gain_muscle",      label: "Gain Muscle" },
      { key: "build_mass",       label: "Build Mass" },
      { key: "muscle_definition",label: "Muscle Definition" },
      { key: "improve_symmetry", label: "Improve Symmetry" },
      { key: "hit_protein",      label: "Hit Protein Goal" },
      { key: "track_macros",     label: "Track Macros" },
    ],
  },
  {
    key: "strength",
    label: "Strength",
    color: "#f59e0b",
    aims: [
      { key: "build_strength",   label: "Build Strength" },
      { key: "increase_1rm",     label: "Increase 1RM" },
      { key: "improve_power",    label: "Improve Power" },
      { key: "deadlift_goal",    label: "Deadlift Goal" },
      { key: "squat_goal",       label: "Squat Goal" },
      { key: "bench_goal",       label: "Bench Press Goal" },
    ],
  },
  {
    key: "fitness",
    label: "Fitness",
    color: "#0b84ff",
    aims: [
      { key: "get_fitter",       label: "Get Fitter" },
      { key: "run_5k",           label: "Run a 5K" },
      { key: "run_10k",          label: "Run a 10K" },
      { key: "increase_steps",   label: "Increase Steps" },
      { key: "improve_endurance",label: "Improve Endurance" },
      { key: "cycle_regularly",  label: "Cycle Regularly" },
    ],
  },
  {
    key: "weight",
    label: "Weight & Body",
    color: "#ef4444",
    aims: [
      { key: "lose_weight",      label: "Lose Weight" },
      { key: "lose_body_fat",    label: "Lose Body Fat" },
      { key: "maintain_weight",  label: "Maintain Weight" },
      { key: "get_toned",        label: "Get Toned" },
      { key: "reduce_waist",     label: "Reduce Waist" },
      { key: "improve_posture",  label: "Improve Posture" },
    ],
  },
  {
    key: "nutrition",
    label: "Nutrition",
    color: "#22c55e",
    aims: [
      { key: "eat_healthier",    label: "Eat Healthier" },
      { key: "balanced_macros",  label: "Balanced Macros" },
      { key: "reduce_sugar",     label: "Reduce Sugar" },
      { key: "drink_more_water", label: "Drink More Water" },
      { key: "meal_prep",        label: "Meal Prep" },
      { key: "cut_junk_food",    label: "Cut Junk Food" },
    ],
  },
  {
    key: "lifestyle",
    label: "Lifestyle",
    color: "#ec4899",
    aims: [
      { key: "better_sleep",     label: "Better Sleep" },
      { key: "more_energy",      label: "More Energy" },
      { key: "reduce_stress",    label: "Reduce Stress" },
      { key: "be_consistent",    label: "Be Consistent" },
      { key: "active_lifestyle", label: "Active Lifestyle" },
      { key: "improve_flexibility", label: "Improve Flexibility" },
    ],
  },
];

export const MAX_AIMS = 10;

// Flat list with category color included, for lookup by label
export const ALL_AIMS_FLAT = AIM_CATEGORIES.flatMap((cat) =>
  cat.aims.map((a) => ({ ...a, color: cat.color, categoryKey: cat.key }))
);

export function getAimColor(label) {
  return ALL_AIMS_FLAT.find((a) => a.label === label)?.color ?? "#0b84ff";
}
