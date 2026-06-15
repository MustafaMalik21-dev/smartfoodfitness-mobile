export const CATEGORY_COLORS = {
  Chest: "#ef4444",
  Back: "#3b82f6",
  Shoulders: "#8b5cf6",
  Biceps: "#f59e0b",
  Triceps: "#ec4899",
  Forearms: "#14b8a6",
  Core: "#22c55e",
  Legs: "#0b84ff",
  Cardio: "#f97316",
};

export const CATEGORY_ICONS = {
  Chest: "dumbbell",
  Back: "weight-lifter",
  Shoulders: "human",
  Biceps: "arm-flex",
  Triceps: "arm-flex-outline",
  Forearms: "hand-wave",
  Core: "yoga",
  Legs: "run",
  Cardio: "heart-pulse",
};

export const EXERCISES = [
  // ─── CHEST ──────────────────────────────────────────────────
  {
    id: "ch01", name: "Barbell Bench Press", category: "Chest",
    equipment: "Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Pectorals"], secondaryMuscles: ["Triceps", "Front Deltoids"],
    instructions: [
      "Lie flat on a bench, feet flat on the floor, back slightly arched.",
      "Grip the barbell slightly wider than shoulder-width with thumbs wrapped.",
      "Unrack the bar and lower it in a controlled arc to your mid-chest.",
      "Press the bar back up to full arm extension without locking out harshly.",
    ],
    tips: "Retract your shoulder blades before unracking — this protects your shoulders.",
  },
  {
    id: "ch02", name: "Dumbbell Bench Press", category: "Chest",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Pectorals"], secondaryMuscles: ["Triceps", "Front Deltoids"],
    instructions: [
      "Lie on a flat bench holding dumbbells at shoulder level, palms facing feet.",
      "Press the dumbbells up and slightly inward until arms are fully extended.",
      "Lower the dumbbells back to chest level with control.",
      "Keep elbows at roughly 45–75° from your torso throughout.",
    ],
    tips: "The greater range of motion vs barbell allows a better stretch at the bottom.",
  },
  {
    id: "ch03", name: "Incline Barbell Bench Press", category: "Chest",
    equipment: "Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Upper Pectorals"], secondaryMuscles: ["Triceps", "Front Deltoids"],
    instructions: [
      "Set the bench to 30–45°. Lie back with feet flat.",
      "Grip the bar slightly wider than shoulder-width.",
      "Lower the bar to your upper chest/clavicle area.",
      "Press back up to full extension.",
    ],
    tips: "A lower incline (30°) targets the upper chest more than the shoulders.",
  },
  {
    id: "ch04", name: "Incline Dumbbell Press", category: "Chest",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Upper Pectorals"], secondaryMuscles: ["Triceps", "Front Deltoids"],
    instructions: [
      "Set bench to 30–45°. Hold a dumbbell in each hand at shoulder level.",
      "Press dumbbells up and slightly together above your upper chest.",
      "Lower with control until you feel a stretch in the chest.",
    ],
    tips: "Keep wrists stacked directly over elbows at the bottom of each rep.",
  },
  {
    id: "ch05", name: "Cable Crossover", category: "Chest",
    equipment: "Cable Machine", difficulty: "Intermediate",
    primaryMuscles: ["Pectorals"], secondaryMuscles: ["Front Deltoids"],
    instructions: [
      "Set cables to the highest position and attach single handles.",
      "Stand in the centre with arms extended, slight forward lean.",
      "Pull the cables downward and across, squeezing at the bottom.",
      "Return slowly to the starting position.",
    ],
    tips: "Focus on the chest squeeze at the point where hands meet, not arm strength.",
  },
  {
    id: "ch06", name: "Pec Deck Fly", category: "Chest",
    equipment: "Machine", difficulty: "Beginner",
    primaryMuscles: ["Pectorals"], secondaryMuscles: ["Front Deltoids"],
    instructions: [
      "Sit in the pec deck machine with back flat against pad.",
      "Place forearms on the arm pads, elbows at shoulder height.",
      "Squeeze chest to bring the arms together in front of you.",
      "Return slowly to full stretch.",
    ],
    tips: "This is a great isolation exercise — use a controlled tempo and avoid going too heavy.",
  },
  {
    id: "ch07", name: "Push Up", category: "Chest",
    equipment: "Bodyweight", difficulty: "Beginner",
    primaryMuscles: ["Pectorals"], secondaryMuscles: ["Triceps", "Core"],
    instructions: [
      "Start in a high plank position with hands slightly wider than shoulder-width.",
      "Keep your body in a straight line from head to heels.",
      "Lower your chest towards the floor by bending elbows.",
      "Push back up to full extension.",
    ],
    tips: "Elbows should flare at ~45°, not straight out to the sides.",
  },
  {
    id: "ch08", name: "Dumbbell Fly", category: "Chest",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Pectorals"], secondaryMuscles: ["Front Deltoids"],
    instructions: [
      "Lie on a flat bench holding dumbbells above your chest, palms facing each other.",
      "With a slight bend in your elbows, lower the dumbbells in an arc out to your sides.",
      "Squeeze your chest to bring the weights back to the starting position.",
    ],
    tips: "Think 'hugging a big tree' — the movement is an arc, not a press.",
  },
  {
    id: "ch09", name: "Decline Bench Press", category: "Chest",
    equipment: "Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Lower Pectorals"], secondaryMuscles: ["Triceps"],
    instructions: [
      "Set bench to a slight decline (15–30°). Hook feet under the rollers.",
      "Grip the bar slightly wider than shoulder-width.",
      "Lower the bar to your lower chest.",
      "Press back up explosively.",
    ],
    tips: "Great for targeting the lower chest. Keep a spotter close for safety.",
  },
  {
    id: "ch10", name: "Chest Dip", category: "Chest",
    equipment: "Dip Bars", difficulty: "Intermediate",
    primaryMuscles: ["Lower Pectorals"], secondaryMuscles: ["Triceps", "Front Deltoids"],
    instructions: [
      "Grip the dip bars and support your full body weight.",
      "Lean slightly forward at the torso (more chest activation vs triceps dips).",
      "Lower your body by bending your elbows until you feel a stretch in your chest.",
      "Push back up to full extension.",
    ],
    tips: "Leaning forward is key — the more you lean, the more chest is targeted.",
  },

  // ─── BACK ────────────────────────────────────────────────────
  {
    id: "ba01", name: "Pull Up", category: "Back",
    equipment: "Pull-Up Bar", difficulty: "Intermediate",
    primaryMuscles: ["Lats"], secondaryMuscles: ["Biceps", "Rear Deltoids"],
    instructions: [
      "Hang from a pull-up bar with an overhand grip wider than shoulder-width.",
      "Engage your core and depress your shoulder blades.",
      "Pull your chest toward the bar by driving elbows down and back.",
      "Lower back to a full hang with control.",
    ],
    tips: "Avoid swinging — slow negatives (3 seconds down) build strength fast.",
  },
  {
    id: "ba02", name: "Barbell Row", category: "Back",
    equipment: "Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Lats", "Rhomboids"], secondaryMuscles: ["Biceps", "Rear Deltoids"],
    instructions: [
      "Stand with feet hip-width, hinge forward 45° with a neutral spine.",
      "Grip the barbell overhand, slightly wider than shoulder-width.",
      "Row the bar to your lower abdomen, squeezing shoulder blades together.",
      "Lower the bar back down with control.",
    ],
    tips: "Lead with your elbows, not your hands. Keep your back flat throughout.",
  },
  {
    id: "ba03", name: "Seated Cable Row", category: "Back",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Rhomboids", "Lats"], secondaryMuscles: ["Biceps"],
    instructions: [
      "Sit at the cable row machine with feet on the footrest, knees slightly bent.",
      "Grab the handle and sit up tall with a neutral spine.",
      "Row the handle to your lower abdomen, squeezing your shoulder blades together.",
      "Return slowly until arms are fully extended.",
    ],
    tips: "Don't lean back to complete the row — that's momentum, not muscle.",
  },
  {
    id: "ba04", name: "Lat Pulldown", category: "Back",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Lats"], secondaryMuscles: ["Biceps", "Rear Deltoids"],
    instructions: [
      "Sit at the lat pulldown machine and grip the bar wider than shoulder-width.",
      "Lean back slightly and pull the bar down to your upper chest.",
      "Squeeze the lats at the bottom of the movement.",
      "Allow the bar to rise back up under control.",
    ],
    tips: "Focus on driving your elbows down to your hips, not pulling with your arms.",
  },
  {
    id: "ba05", name: "Single Arm Dumbbell Row", category: "Back",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Lats", "Rhomboids"], secondaryMuscles: ["Biceps"],
    instructions: [
      "Place one knee and hand on a bench for support, other foot on the ground.",
      "Hold a dumbbell in the free hand with a neutral grip.",
      "Row the dumbbell up toward your hip, keeping your elbow close to your body.",
      "Lower with control to the starting position.",
    ],
    tips: "Keep your torso parallel to the ground throughout the movement.",
  },
  {
    id: "ba06", name: "Deadlift", category: "Back",
    equipment: "Barbell", difficulty: "Advanced",
    primaryMuscles: ["Erector Spinae", "Glutes"], secondaryMuscles: ["Hamstrings", "Lats", "Traps"],
    instructions: [
      "Stand with feet hip-width, bar over mid-foot. Hinge down and grip bar just outside legs.",
      "Take a deep breath, brace your core, and pull your shoulder blades back.",
      "Drive through your heels to lift the bar, keeping it close to your body.",
      "Lock out hips and knees at the top, then lower with control.",
    ],
    tips: "The bar should drag up your shins. If it drifts away, your lower back takes over.",
  },
  {
    id: "ba07", name: "T-Bar Row", category: "Back",
    equipment: "T-Bar Machine", difficulty: "Intermediate",
    primaryMuscles: ["Lats", "Rhomboids"], secondaryMuscles: ["Biceps", "Rear Deltoids"],
    instructions: [
      "Straddle the T-bar and hinge forward to ~45°.",
      "Grip the handles and row toward your chest.",
      "Squeeze your shoulder blades at the top.",
      "Lower with control to full arm extension.",
    ],
    tips: "Keep your head in a neutral position — don't crane your neck up.",
  },
  {
    id: "ba08", name: "Face Pull", category: "Back",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Rear Deltoids", "Rhomboids"], secondaryMuscles: ["Rotator Cuff"],
    instructions: [
      "Set cable to head height with a rope attachment.",
      "Pull the rope toward your face, separating your hands as you pull.",
      "Finish with elbows high and hands beside your ears.",
      "Return to the start with control.",
    ],
    tips: "Excellent for shoulder health. Include it in every upper body day.",
  },
  {
    id: "ba09", name: "Straight Arm Pulldown", category: "Back",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Lats"], secondaryMuscles: ["Triceps Long Head"],
    instructions: [
      "Stand at a high cable with a straight bar or rope attachment.",
      "Hinge slightly forward, arms extended above you.",
      "Keeping arms straight, pull the bar down to your thighs.",
      "Slowly return to the start.",
    ],
    tips: "Pure lat isolation — great as a warm-up or finisher for back day.",
  },
  {
    id: "ba10", name: "Chin Up", category: "Back",
    equipment: "Pull-Up Bar", difficulty: "Intermediate",
    primaryMuscles: ["Lats"], secondaryMuscles: ["Biceps"],
    instructions: [
      "Hang from a bar with an underhand (supinated) grip at shoulder-width.",
      "Pull your chin above the bar by driving elbows down.",
      "Lower back to a full dead hang with control.",
    ],
    tips: "The underhand grip engages biceps more than a pull-up, making it slightly easier.",
  },

  // ─── SHOULDERS ───────────────────────────────────────────────
  {
    id: "sh01", name: "Barbell Overhead Press", category: "Shoulders",
    equipment: "Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Front Deltoids"], secondaryMuscles: ["Lateral Deltoids", "Triceps"],
    instructions: [
      "Stand with feet shoulder-width. Hold the bar at collarbone height, overhand grip.",
      "Brace your core and press the bar straight up overhead.",
      "Lock out arms at the top, bar directly over your heels.",
      "Lower back to the collarbone with control.",
    ],
    tips: "Push your head through at the top — this keeps the bar path efficient.",
  },
  {
    id: "sh02", name: "Dumbbell Shoulder Press", category: "Shoulders",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Front Deltoids"], secondaryMuscles: ["Lateral Deltoids", "Triceps"],
    instructions: [
      "Sit on an upright bench. Hold dumbbells at ear level, palms facing forward.",
      "Press dumbbells overhead until arms are extended.",
      "Lower back to ear level with control.",
    ],
    tips: "A slight inward arc at the top (palms slightly inward) can feel more natural.",
  },
  {
    id: "sh03", name: "Lateral Raise", category: "Shoulders",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Lateral Deltoids"], secondaryMuscles: [],
    instructions: [
      "Stand with dumbbells at your sides, slight bend in elbows.",
      "Raise both arms out to the sides until parallel with the floor.",
      "Pause at the top then lower slowly.",
    ],
    tips: "Lead with your elbows, not your hands. Use light weight and slow tempo.",
  },
  {
    id: "sh04", name: "Front Raise", category: "Shoulders",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Front Deltoids"], secondaryMuscles: [],
    instructions: [
      "Stand holding dumbbells in front of your thighs, overhand grip.",
      "Raise both arms forward to shoulder height.",
      "Lower slowly back to the start.",
    ],
    tips: "Avoid swinging — keep your core tight and movement strict.",
  },
  {
    id: "sh05", name: "Reverse Fly", category: "Shoulders",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Rear Deltoids"], secondaryMuscles: ["Rhomboids"],
    instructions: [
      "Hinge forward at the hips to ~45°, dumbbells hanging below chest.",
      "With a slight bend in the elbows, raise arms out to the sides.",
      "Squeeze shoulder blades at the top, then lower with control.",
    ],
    tips: "This targets the oft-neglected rear deltoids — crucial for shoulder health.",
  },
  {
    id: "sh06", name: "Arnold Press", category: "Shoulders",
    equipment: "Dumbbells", difficulty: "Intermediate",
    primaryMuscles: ["Front Deltoids", "Lateral Deltoids"], secondaryMuscles: ["Triceps"],
    instructions: [
      "Sit with dumbbells at shoulder height, palms facing you (like the top of a curl).",
      "As you press up, rotate your palms forward.",
      "At the top, palms face away and arms are extended.",
      "Reverse the rotation on the way back down.",
    ],
    tips: "The rotation hits all three deltoid heads across the range of motion.",
  },
  {
    id: "sh07", name: "Upright Row", category: "Shoulders",
    equipment: "Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Lateral Deltoids", "Traps"], secondaryMuscles: ["Biceps"],
    instructions: [
      "Stand holding a barbell with a narrow overhand grip.",
      "Pull the bar straight up along your body to chin height.",
      "Lead with your elbows — they should rise above your wrists.",
      "Lower with control.",
    ],
    tips: "Use a shoulder-width or slightly wider grip to reduce shoulder impingement risk.",
  },
  {
    id: "sh08", name: "Barbell Shrug", category: "Shoulders",
    equipment: "Barbell", difficulty: "Beginner",
    primaryMuscles: ["Trapezius"], secondaryMuscles: [],
    instructions: [
      "Stand holding a barbell in front of you, arms straight.",
      "Shrug your shoulders straight up toward your ears.",
      "Hold briefly at the top, then lower slowly.",
    ],
    tips: "Don't roll your shoulders — straight up and straight down is correct.",
  },

  // ─── BICEPS ──────────────────────────────────────────────────
  {
    id: "ar01", name: "Barbell Curl", category: "Biceps",
    equipment: "Barbell", difficulty: "Beginner",
    primaryMuscles: ["Biceps"], secondaryMuscles: ["Brachialis"],
    instructions: [
      "Stand holding a barbell with a supinated (underhand) grip at hip level.",
      "Keeping elbows at your sides, curl the bar up to shoulder height.",
      "Squeeze the biceps at the top, then lower with control.",
    ],
    tips: "Pin your elbows to your sides — if they drift forward, the weight is too heavy.",
  },
  {
    id: "ar02", name: "Dumbbell Curl", category: "Biceps",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Biceps"], secondaryMuscles: ["Brachialis"],
    instructions: [
      "Stand holding dumbbells at your sides with palms facing forward.",
      "Curl both dumbbells up to shoulder height simultaneously or alternating.",
      "Lower slowly to full extension.",
    ],
    tips: "Fully extend at the bottom to maximise the range of motion.",
  },
  {
    id: "ar03", name: "Hammer Curl", category: "Biceps",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Brachialis", "Brachioradialis"], secondaryMuscles: ["Biceps"],
    instructions: [
      "Hold dumbbells at your sides with a neutral grip (palms facing each other).",
      "Curl both dumbbells up to shoulder height without rotating your wrists.",
      "Lower slowly to the start.",
    ],
    tips: "Targets the brachialis, which lies underneath the bicep and adds arm width.",
  },
  {
    id: "ar04", name: "Concentration Curl", category: "Biceps",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Biceps"], secondaryMuscles: [],
    instructions: [
      "Sit on a bench, elbow resting on your inner thigh.",
      "Curl the dumbbell up toward your shoulder.",
      "Squeeze at the top, then lower fully.",
    ],
    tips: "Bracing the elbow eliminates cheating — great for building the peak.",
  },
  {
    id: "ar05", name: "EZ Bar Curl", category: "Biceps",
    equipment: "EZ Bar", difficulty: "Beginner",
    primaryMuscles: ["Biceps"], secondaryMuscles: ["Brachialis"],
    instructions: [
      "Hold an EZ bar at the angled grips, arms fully extended.",
      "Curl the bar up to shoulder height, keeping elbows tucked.",
      "Lower back to full extension.",
    ],
    tips: "The angled grip is easier on the wrists than a straight bar.",
  },
  {
    id: "ar06", name: "Preacher Curl", category: "Biceps",
    equipment: "EZ Bar / Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Biceps"], secondaryMuscles: [],
    instructions: [
      "Sit at a preacher bench with upper arms resting on the pad.",
      "Hold the bar with an underhand grip and arms nearly extended.",
      "Curl the bar up toward your face.",
      "Lower slowly — stop just before full lock-out.",
    ],
    tips: "Don't let the weight snap your elbows at the bottom — control the negative.",
  },
  // ─── TRICEPS ─────────────────────────────────────────────────
  {
    id: "ar07", name: "Tricep Pushdown", category: "Triceps",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Triceps"], secondaryMuscles: [],
    instructions: [
      "Stand at a high cable with a bar or rope attachment.",
      "Keep elbows pinned at your sides and push the attachment down.",
      "Fully extend your arms at the bottom.",
      "Return slowly to the starting position.",
    ],
    tips: "For the rope variation, spread the handles apart at the bottom for extra squeeze.",
  },
  {
    id: "ar08", name: "Skull Crusher", category: "Triceps",
    equipment: "EZ Bar / Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Triceps"], secondaryMuscles: [],
    instructions: [
      "Lie on a flat bench holding an EZ bar above your chest.",
      "Keeping upper arms vertical, lower the bar toward your forehead.",
      "Extend back to the starting position by straightening your elbows.",
    ],
    tips: "Allowing upper arms to drift back slightly increases the stretch on the long head.",
  },
  {
    id: "ar09", name: "Tricep Dip", category: "Triceps",
    equipment: "Dip Bars / Bench", difficulty: "Beginner",
    primaryMuscles: ["Triceps"], secondaryMuscles: ["Front Deltoids"],
    instructions: [
      "Place hands on dip bars or the edge of a bench.",
      "Keep your torso upright (unlike chest dips which lean forward).",
      "Lower your body by bending elbows to ~90°.",
      "Press back up to full extension.",
    ],
    tips: "Staying upright is essential — any forward lean shifts work to the chest.",
  },
  {
    id: "ar10", name: "Overhead Tricep Extension", category: "Triceps",
    equipment: "Dumbbell / Cable", difficulty: "Beginner",
    primaryMuscles: ["Triceps"], secondaryMuscles: [],
    instructions: [
      "Hold one dumbbell with both hands overhead, arms fully extended.",
      "Lower the dumbbell behind your head by bending elbows.",
      "Extend back up to the starting position.",
    ],
    tips: "Stretches the long head of the tricep — one of the best mass-builders.",
  },

  // ─── CORE ────────────────────────────────────────────────────
  {
    id: "co01", name: "Plank", category: "Core",
    equipment: "Bodyweight", difficulty: "Beginner",
    primaryMuscles: ["Transverse Abdominis"], secondaryMuscles: ["Glutes", "Shoulders"],
    instructions: [
      "Get into a push-up position but rest on your forearms.",
      "Keep your body in a straight line from head to heels.",
      "Engage your core and glutes — don't let your hips sag or rise.",
      "Hold for time.",
    ],
    tips: "Quality over quantity — a 20s plank with perfect form beats a sagging 60s plank.",
  },
  {
    id: "co02", name: "Crunch", category: "Core",
    equipment: "Bodyweight", difficulty: "Beginner",
    primaryMuscles: ["Rectus Abdominis"], secondaryMuscles: [],
    instructions: [
      "Lie on your back, knees bent, feet flat on the floor.",
      "Place hands lightly behind your head (don't pull on your neck).",
      "Curl your upper body toward your knees, exhaling as you rise.",
      "Lower back down without fully relaxing.",
    ],
    tips: "Only your upper back should leave the floor — this is not a sit-up.",
  },
  {
    id: "co03", name: "Bicycle Crunch", category: "Core",
    equipment: "Bodyweight", difficulty: "Beginner",
    primaryMuscles: ["Obliques", "Rectus Abdominis"], secondaryMuscles: [],
    instructions: [
      "Lie on your back with hands behind your head and legs raised.",
      "Bring one knee toward your chest while rotating your opposite elbow toward it.",
      "Alternate sides in a pedalling motion.",
    ],
    tips: "Move slowly and deliberately — fast bicycle crunches lose most of the benefit.",
  },
  {
    id: "co04", name: "Leg Raise", category: "Core",
    equipment: "Bodyweight", difficulty: "Intermediate",
    primaryMuscles: ["Lower Rectus Abdominis", "Hip Flexors"], secondaryMuscles: [],
    instructions: [
      "Lie flat on your back, legs straight and together.",
      "Keeping legs straight, raise them to 90° (or as far as possible).",
      "Lower them back down, stopping just before they touch the floor.",
    ],
    tips: "Press your lower back into the floor throughout — prevents injury.",
  },
  {
    id: "co05", name: "Russian Twist", category: "Core",
    equipment: "Bodyweight / Plate", difficulty: "Beginner",
    primaryMuscles: ["Obliques"], secondaryMuscles: ["Rectus Abdominis"],
    instructions: [
      "Sit on the floor with knees bent and feet elevated or flat.",
      "Lean back to ~45°, keeping spine straight.",
      "Rotate your torso from side to side, touching the floor beside each hip.",
    ],
    tips: "Add a weight plate or medicine ball for a more challenging variation.",
  },
  {
    id: "co06", name: "Hanging Leg Raise", category: "Core",
    equipment: "Pull-Up Bar", difficulty: "Advanced",
    primaryMuscles: ["Rectus Abdominis", "Hip Flexors"], secondaryMuscles: ["Obliques"],
    instructions: [
      "Hang from a pull-up bar with a shoulder-width grip.",
      "Keeping legs together and straight, raise them to hip height or above.",
      "Lower with control without swinging.",
    ],
    tips: "Posterior pelvic tilt at the top (curling your pelvis up) maximises ab activation.",
  },
  {
    id: "co07", name: "Cable Crunch", category: "Core",
    equipment: "Cable Machine", difficulty: "Intermediate",
    primaryMuscles: ["Rectus Abdominis"], secondaryMuscles: [],
    instructions: [
      "Kneel at a high cable with a rope attachment. Hold rope behind your head.",
      "Crunch your elbows toward your knees, rounding your back.",
      "Pause at the bottom, then return to the start.",
    ],
    tips: "Hip position should stay fixed — only your spine should flex.",
  },
  {
    id: "co08", name: "Ab Wheel Rollout", category: "Core",
    equipment: "Ab Wheel", difficulty: "Advanced",
    primaryMuscles: ["Transverse Abdominis", "Rectus Abdominis"], secondaryMuscles: ["Lats", "Shoulders"],
    instructions: [
      "Kneel on the floor with hands on the ab wheel.",
      "Roll the wheel forward, extending your body as far as possible without arching your back.",
      "Pull back to the starting position using your core.",
    ],
    tips: "Start with small rollouts and build range progressively — it's deceptively difficult.",
  },

  // ─── LEGS ────────────────────────────────────────────────────
  {
    id: "le01", name: "Barbell Back Squat", category: "Legs",
    equipment: "Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Quadriceps", "Glutes"], secondaryMuscles: ["Hamstrings", "Erector Spinae"],
    instructions: [
      "Position a barbell on your upper traps. Stand with feet shoulder-width.",
      "Brace your core and begin the descent by pushing hips back and bending knees.",
      "Squat until thighs are parallel or below parallel.",
      "Drive through your heels to return to standing.",
    ],
    tips: "Keep your chest up and knees tracking over your toes throughout.",
  },
  {
    id: "le02", name: "Leg Press", category: "Legs",
    equipment: "Machine", difficulty: "Beginner",
    primaryMuscles: ["Quadriceps", "Glutes"], secondaryMuscles: ["Hamstrings"],
    instructions: [
      "Sit in the leg press machine with feet shoulder-width on the platform.",
      "Release the safety handles and lower the platform by bending knees to 90°.",
      "Press the platform back to near full extension.",
      "Re-engage the safety handles at the end of the set.",
    ],
    tips: "Don't lock your knees fully at the top — maintain tension throughout.",
  },
  {
    id: "le03", name: "Romanian Deadlift", category: "Legs",
    equipment: "Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Hamstrings", "Glutes"], secondaryMuscles: ["Erector Spinae"],
    instructions: [
      "Stand holding a barbell at hip level with a shoulder-width overhand grip.",
      "Hinge at the hips, pushing them back while lowering the bar down your legs.",
      "Lower until you feel a deep stretch in your hamstrings.",
      "Drive hips forward to return to standing.",
    ],
    tips: "Keep the bar close to your legs — if it drifts out, your lower back takes over.",
  },
  {
    id: "le04", name: "Lunges", category: "Legs",
    equipment: "Bodyweight / Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Quadriceps", "Glutes"], secondaryMuscles: ["Hamstrings", "Calves"],
    instructions: [
      "Stand upright with feet hip-width apart.",
      "Step forward with one leg and lower your back knee toward the floor.",
      "Keep your front shin vertical and torso upright.",
      "Push through your front heel to return to standing.",
    ],
    tips: "Walking lunges are more demanding — stationary lunges are great for beginners.",
  },
  {
    id: "le05", name: "Leg Extension", category: "Legs",
    equipment: "Machine", difficulty: "Beginner",
    primaryMuscles: ["Quadriceps"], secondaryMuscles: [],
    instructions: [
      "Sit in the leg extension machine with ankles hooked under the pad.",
      "Extend your legs until they are fully straight.",
      "Lower the weight back down with control.",
    ],
    tips: "Pure quad isolation — use lighter weight and focus on the squeeze at extension.",
  },
  {
    id: "le06", name: "Leg Curl", category: "Legs",
    equipment: "Machine", difficulty: "Beginner",
    primaryMuscles: ["Hamstrings"], secondaryMuscles: [],
    instructions: [
      "Lie face down on the leg curl machine with the roller behind your ankles.",
      "Curl your legs up, bringing your heels toward your glutes.",
      "Lower slowly back to the start.",
    ],
    tips: "Avoid letting your hips lift off the pad — that indicates too much weight.",
  },
  {
    id: "le07", name: "Hip Thrust", category: "Legs",
    equipment: "Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Glutes"], secondaryMuscles: ["Hamstrings"],
    instructions: [
      "Sit on the floor with upper back against a bench. Rest a barbell across your hips.",
      "Plant feet hip-width, bend knees.",
      "Drive through your heels and thrust hips up until your body is parallel to the floor.",
      "Squeeze glutes at the top, then lower.",
    ],
    tips: "The best exercise for glute development. Drive through your heels, not your toes.",
  },
  {
    id: "le08", name: "Calf Raise", category: "Legs",
    equipment: "Machine / Bodyweight", difficulty: "Beginner",
    primaryMuscles: ["Calves (Gastrocnemius, Soleus)"], secondaryMuscles: [],
    instructions: [
      "Stand with the balls of your feet on a step or calf raise machine.",
      "Rise up onto your toes as high as possible.",
      "Lower your heels below the platform for a full stretch.",
    ],
    tips: "Calves respond well to high volume — aim for 15+ reps and slow negatives.",
  },
  {
    id: "le09", name: "Bulgarian Split Squat", category: "Legs",
    equipment: "Dumbbells", difficulty: "Advanced",
    primaryMuscles: ["Quadriceps", "Glutes"], secondaryMuscles: ["Hamstrings"],
    instructions: [
      "Stand in front of a bench. Place the top of one foot on the bench behind you.",
      "Lower your back knee toward the floor.",
      "Keep your torso upright and front shin vertical.",
      "Drive through your front foot to return to standing.",
    ],
    tips: "One of the toughest single-leg exercises — start with bodyweight and progress slowly.",
  },
  {
    id: "le10", name: "Goblet Squat", category: "Legs",
    equipment: "Kettlebell / Dumbbell", difficulty: "Beginner",
    primaryMuscles: ["Quadriceps", "Glutes"], secondaryMuscles: ["Core"],
    instructions: [
      "Hold a dumbbell or kettlebell at chest height, elbows tucked in.",
      "Stand with feet slightly wider than shoulder-width.",
      "Squat down until hips are below knees.",
      "Drive through your heels to return to standing.",
    ],
    tips: "Great squat teaching tool — the front load keeps you upright naturally.",
  },

  // ─── CARDIO ──────────────────────────────────────────────────
  {
    id: "ca01", name: "Treadmill Run", category: "Cardio",
    equipment: "Treadmill", difficulty: "Beginner",
    primaryMuscles: ["Cardiovascular System", "Legs"], secondaryMuscles: [],
    instructions: [
      "Warm up with a 2-minute walk.",
      "Set your target pace and maintain it for the planned duration.",
      "Keep an upright posture and relaxed shoulders.",
      "Cool down with a 2-minute walk and stretch afterwards.",
    ],
    tips: "Zone 2 cardio (conversational pace) is ideal for fat burning and aerobic base.",
  },
  {
    id: "ca02", name: "Stationary Bike", category: "Cardio",
    equipment: "Stationary Bike", difficulty: "Beginner",
    primaryMuscles: ["Cardiovascular System", "Quadriceps"], secondaryMuscles: [],
    instructions: [
      "Set the seat height so your knee has a slight bend at the bottom of the pedal stroke.",
      "Start at a low resistance to warm up.",
      "Maintain a cadence of 70–90 RPM at your target heart rate.",
    ],
    tips: "Low impact on joints — great option when legs are sore from weight training.",
  },
  {
    id: "ca03", name: "Jump Rope", category: "Cardio",
    equipment: "Jump Rope", difficulty: "Beginner",
    primaryMuscles: ["Cardiovascular System", "Calves"], secondaryMuscles: ["Shoulders"],
    instructions: [
      "Hold rope handles and stand with feet hip-width.",
      "Jump with both feet, rotating the rope with your wrists.",
      "Land softly on the balls of your feet.",
      "Start with sets of 30 seconds and build up.",
    ],
    tips: "One of the most calorie-dense cardio tools available. Just 10 minutes = solid conditioning.",
  },
  {
    id: "ca04", name: "Rowing Machine", category: "Cardio",
    equipment: "Rowing Machine", difficulty: "Intermediate",
    primaryMuscles: ["Cardiovascular System", "Back", "Legs"], secondaryMuscles: ["Arms"],
    instructions: [
      "Sit on the rower with feet strapped in and handle in hand.",
      "Drive through your legs first, then lean back, then pull the handle to your lower chest.",
      "Return: extend arms, lean forward, then bend knees.",
      "Aim for 500m-1km intervals with rest periods.",
    ],
    tips: "The rowing stroke is 60% legs, 20% core, 20% arms — not an arm exercise.",
  },
  {
    id: "ca05", name: "Burpee", category: "Cardio",
    equipment: "Bodyweight", difficulty: "Intermediate",
    primaryMuscles: ["Full Body"], secondaryMuscles: [],
    instructions: [
      "Start standing. Drop your hands to the floor and jump feet back into a plank.",
      "Perform a push-up (optional).",
      "Jump feet forward, then explode up with arms overhead.",
      "Land softly and immediately repeat.",
    ],
    tips: "One of the best full-body conditioning exercises. Modify by stepping instead of jumping.",
  },
  {
    id: "ca06", name: "Stair Climber", category: "Cardio",
    equipment: "Stair Climber Machine", difficulty: "Beginner",
    primaryMuscles: ["Cardiovascular System", "Glutes", "Quads"], secondaryMuscles: ["Calves"],
    instructions: [
      "Set the machine speed and step onto the pedals.",
      "Stand upright — avoid leaning heavily on the handrails.",
      "Take full steps and drive through your glutes.",
    ],
    tips: "Touch the handrails lightly for balance only — full bodyweight on the steps burns more calories.",
  },
  // ─── CHEST (extra) ──────────────────────────────────────────
  {
    id: "ch11", name: "Cable Fly", category: "Chest",
    equipment: "Cable Machine", difficulty: "Intermediate",
    primaryMuscles: ["Pectorals"], secondaryMuscles: ["Front Deltoids"],
    instructions: [
      "Set both cable pulleys to shoulder height.",
      "Stand in the centre, one foot forward, and hold handles with slight elbow bend.",
      "Bring hands together in front of you in a wide arc.",
      "Return slowly to the start, keeping the slight bend in your elbows.",
    ],
    tips: "Cables keep tension on the chest throughout — far better than dumbbell flys at the top.",
  },
  {
    id: "ch12", name: "Chest Dip", category: "Chest",
    equipment: "Dip Bars", difficulty: "Intermediate",
    primaryMuscles: ["Lower Pectorals"], secondaryMuscles: ["Triceps", "Front Deltoids"],
    instructions: [
      "Grip parallel bars and start with arms locked out.",
      "Lean your torso forward at roughly 30°.",
      "Lower yourself until your upper arms are parallel to the floor.",
      "Press back up to full extension without locking your elbows violently.",
    ],
    tips: "The forward lean is what makes this a chest exercise — stay upright and it becomes a tricep dip.",
  },
  {
    id: "ch13", name: "Svend Press", category: "Chest",
    equipment: "Weight Plates", difficulty: "Beginner",
    primaryMuscles: ["Pectorals"], secondaryMuscles: ["Front Deltoids"],
    instructions: [
      "Hold two small plates together between your palms at chest height.",
      "Press outward, squeezing the plates together hard throughout.",
      "Extend your arms fully, then return to chest.",
    ],
    tips: "The constant squeeze is what makes this effective — don't let the plates separate.",
  },
  {
    id: "ch14", name: "Decline Dumbbell Fly", category: "Chest",
    equipment: "Dumbbells", difficulty: "Intermediate",
    primaryMuscles: ["Lower Pectorals"], secondaryMuscles: ["Front Deltoids"],
    instructions: [
      "Lie on a decline bench holding dumbbells above your chest.",
      "Open your arms wide in a slow arc, keeping a slight bend at the elbows.",
      "Stop when you feel a deep stretch, then bring the weights back together.",
    ],
    tips: "The decline angle targets the often-neglected lower chest line.",
  },

  // ─── BACK (extra) ───────────────────────────────────────────
  {
    id: "bk11", name: "Chest-Supported Row", category: "Back",
    equipment: "Dumbbells / Machine", difficulty: "Beginner",
    primaryMuscles: ["Mid Traps", "Rhomboids"], secondaryMuscles: ["Biceps"],
    instructions: [
      "Set an incline bench to 30–45°. Lie face-down with chest on the pad.",
      "Hold dumbbells and row them toward your hips, squeezing shoulder blades together.",
      "Lower fully before repeating.",
    ],
    tips: "Chest support removes the lower back from the equation — great for isolating back muscles.",
  },
  {
    id: "bk12", name: "Straight-Arm Pulldown", category: "Back",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Lats"], secondaryMuscles: ["Triceps"],
    instructions: [
      "Stand at a high cable pulley with a straight bar or rope.",
      "Keep arms straight (slight bend at elbow) and pull the bar down to your thighs.",
      "Squeeze your lats at the bottom, then return slowly.",
    ],
    tips: "A great isolation move for the lats — think of pulling your elbows to your hips.",
  },
  {
    id: "bk13", name: "Good Morning", category: "Back",
    equipment: "Barbell", difficulty: "Advanced",
    primaryMuscles: ["Erector Spinae"], secondaryMuscles: ["Hamstrings", "Glutes"],
    instructions: [
      "Place a barbell across your upper traps — lighter than you'd squat.",
      "Stand with feet shoulder-width, slight knee bend.",
      "Hinge at the hips, lowering your chest toward the floor, back flat.",
      "Drive hips forward to return to standing.",
    ],
    tips: "Start light — this is a hip hinge drill that warms up the posterior chain.",
  },
  {
    id: "bk14", name: "Pendlay Row", category: "Back",
    equipment: "Barbell", difficulty: "Advanced",
    primaryMuscles: ["Lats", "Rhomboids"], secondaryMuscles: ["Biceps", "Erector Spinae"],
    instructions: [
      "Set up like a barbell row but let the bar rest on the floor between each rep.",
      "Torso parallel to the floor. Pull the bar explosively to your lower chest.",
      "Lower under control and let go — reset your position each rep.",
    ],
    tips: "The dead-stop removes momentum and forces pure muscle contraction. More technical but more honest.",
  },

  // ─── SHOULDERS (extra) ──────────────────────────────────────
  {
    id: "sh09", name: "Arnold Press", category: "Shoulders",
    equipment: "Dumbbells", difficulty: "Intermediate",
    primaryMuscles: ["All Three Deltoid Heads"], secondaryMuscles: ["Triceps"],
    instructions: [
      "Hold dumbbells in front of your face, palms facing you.",
      "As you press up, rotate your palms outward so they face away at the top.",
      "Reverse the rotation as you lower back to start.",
    ],
    tips: "The rotation recruits all three deltoid heads in one movement. Go lighter than a standard press.",
  },
  {
    id: "sh10", name: "Face Pull", category: "Shoulders",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Rear Deltoids", "External Rotators"], secondaryMuscles: ["Traps"],
    instructions: [
      "Set a rope attachment at eye level on a cable machine.",
      "Pull the rope toward your face, flaring elbows out and back.",
      "Aim to pull the rope apart at your ears.",
      "Return slowly.",
    ],
    tips: "Arguably the best shoulder health exercise — essential if you press heavy frequently.",
  },
  {
    id: "sh11", name: "Upright Row", category: "Shoulders",
    equipment: "Barbell / Dumbbells", difficulty: "Intermediate",
    primaryMuscles: ["Side Deltoids", "Upper Traps"], secondaryMuscles: ["Biceps"],
    instructions: [
      "Hold the barbell with a shoulder-width grip, palms facing you.",
      "Pull the bar straight up along your body to chin level, elbows flaring out.",
      "Lower with control.",
    ],
    tips: "Use a wider grip to reduce impingement risk. Stop at chest height if you feel shoulder discomfort.",
  },
  {
    id: "sh12", name: "Cable Lateral Raise", category: "Shoulders",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Side Deltoids"], secondaryMuscles: [],
    instructions: [
      "Stand side-on to a low cable pulley. Hold the handle with the far hand.",
      "Raise the handle out to shoulder height in a smooth arc.",
      "Lower slowly.",
    ],
    tips: "Cables provide constant tension unlike dumbbells which unload at the bottom — better muscle stimulus.",
  },

  // ─── BICEPS (extra) ─────────────────────────────────────────
  {
    id: "ar11", name: "Incline Dumbbell Curl", category: "Biceps",
    equipment: "Dumbbells", difficulty: "Intermediate",
    primaryMuscles: ["Biceps Long Head"], secondaryMuscles: [],
    instructions: [
      "Set an incline bench to 45–60°. Sit back, arms hanging straight.",
      "Curl both dumbbells toward your shoulders without letting upper arms drift forward.",
      "Lower fully to feel the stretch.",
    ],
    tips: "The incline stretches the long head of the bicep — key for the peak.",
  },
  {
    id: "ar12", name: "Concentration Curl", category: "Biceps",
    equipment: "Dumbbell", difficulty: "Beginner",
    primaryMuscles: ["Biceps"], secondaryMuscles: [],
    instructions: [
      "Sit on a bench, elbow braced against your inner thigh.",
      "Curl the dumbbell toward your shoulder, squeezing at the top.",
      "Lower fully between reps.",
    ],
    tips: "The braced elbow forces strict form and maximum bicep contraction.",
  },
  {
    id: "ar13", name: "Close-Grip Bench Press", category: "Triceps",
    equipment: "Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Triceps"], secondaryMuscles: ["Pectorals", "Front Deltoids"],
    instructions: [
      "Lie flat on a bench. Grip the barbell shoulder-width or slightly narrower.",
      "Lower the bar to your lower chest, keeping elbows close to your body.",
      "Press back up to full extension.",
    ],
    tips: "A compound movement for triceps — allows much heavier loads than isolation exercises.",
  },
  // ─── FOREARMS (extra) ───────────────────────────────────────
  {
    id: "ar14", name: "Reverse Curl", category: "Forearms",
    equipment: "Barbell / Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Brachialis", "Brachioradialis"], secondaryMuscles: ["Biceps"],
    instructions: [
      "Hold the bar with a pronated (overhand) grip.",
      "Curl the bar toward your shoulders, keeping elbows pinned.",
      "Lower under control.",
    ],
    tips: "Targets the brachialis — a key muscle for adding arm thickness under the bicep.",
  },

  // ─── CORE (extra) ───────────────────────────────────────────
  {
    id: "co09", name: "Cable Crunch", category: "Core",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Rectus Abdominis"], secondaryMuscles: [],
    instructions: [
      "Kneel in front of a high cable pulley with a rope attachment.",
      "Hold the rope at your temples and flex your spine downward.",
      "Crunch your elbows toward your knees, squeezing the abs hard.",
      "Return slowly — don't use hip flexors to pull up.",
    ],
    tips: "One of the few ab exercises with load — great for building visible definition.",
  },
  {
    id: "co10", name: "Pallof Press", category: "Core",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Obliques", "Transverse Abdominis"], secondaryMuscles: [],
    instructions: [
      "Stand side-on to a cable set at chest height.",
      "Hold the handle with both hands at your chest.",
      "Press the handle straight out in front of you and hold for 2 seconds.",
      "Return to chest and repeat.",
    ],
    tips: "An anti-rotation exercise — trains the core to resist twisting forces which protects the spine.",
  },
  {
    id: "co11", name: "Hanging Leg Raise", category: "Core",
    equipment: "Pull-up Bar", difficulty: "Intermediate",
    primaryMuscles: ["Lower Abs", "Hip Flexors"], secondaryMuscles: [],
    instructions: [
      "Hang from a pull-up bar with a shoulder-width grip.",
      "Keep legs straight (or bent for easier variation) and raise them to hip height or above.",
      "Lower slowly to avoid swinging.",
    ],
    tips: "Control the descent — lowering is where the abs work hardest.",
  },
  {
    id: "co12", name: "Ab Wheel Rollout", category: "Core",
    equipment: "Ab Wheel", difficulty: "Advanced",
    primaryMuscles: ["Rectus Abdominis", "Transverse Abdominis"], secondaryMuscles: ["Lats", "Shoulders"],
    instructions: [
      "Kneel with hands on the ab wheel.",
      "Roll forward slowly, keeping your back flat.",
      "Go as far as you can while maintaining control.",
      "Pull back by contracting your abs and lats.",
    ],
    tips: "Start with partial rollouts — going too far before you're ready strains the lower back.",
  },

  // ─── LEGS (extra) ───────────────────────────────────────────
  {
    id: "lg11", name: "Sumo Squat", category: "Legs",
    equipment: "Barbell / Dumbbell", difficulty: "Beginner",
    primaryMuscles: ["Inner Quads", "Glutes", "Adductors"], secondaryMuscles: ["Hamstrings"],
    instructions: [
      "Stand with feet wider than shoulder-width, toes pointed out 45°.",
      "Hold a dumbbell between your legs or a barbell on your traps.",
      "Squat down keeping your chest tall and knees tracking over toes.",
      "Drive through your heels to stand.",
    ],
    tips: "The wide stance shifts emphasis to the inner quads and glutes compared to a standard squat.",
  },
  {
    id: "lg12", name: "Glute Bridge", category: "Legs",
    equipment: "Bodyweight / Barbell", difficulty: "Beginner",
    primaryMuscles: ["Glutes"], secondaryMuscles: ["Hamstrings", "Core"],
    instructions: [
      "Lie on your back, knees bent, feet flat on the floor.",
      "Drive through your heels to lift your hips until your body is in a straight line from knees to shoulders.",
      "Squeeze your glutes hard at the top.",
      "Lower slowly.",
    ],
    tips: "Hold a barbell across your hips to add resistance as you progress.",
  },
  {
    id: "lg13", name: "Nordic Hamstring Curl", category: "Legs",
    equipment: "Partner / Machine", difficulty: "Advanced",
    primaryMuscles: ["Hamstrings"], secondaryMuscles: ["Glutes"],
    instructions: [
      "Kneel with feet anchored (partner holds ankles or use a machine).",
      "Lower your body toward the floor slowly, resisting with your hamstrings.",
      "Use hands to catch yourself at the bottom, then push back up.",
    ],
    tips: "One of the best exercises for hamstring injury prevention. Very difficult — build up slowly.",
  },
  {
    id: "lg14", name: "Sissy Squat", category: "Legs",
    equipment: "Bodyweight", difficulty: "Advanced",
    primaryMuscles: ["Quads"], secondaryMuscles: [],
    instructions: [
      "Stand with feet narrow, holding something for balance.",
      "Rise onto your toes and lean back, bending at the knees.",
      "Lower your body until thighs are parallel to the floor — your torso leans back.",
      "Drive back up through your quads.",
    ],
    tips: "Brutal quad isolation — approach slowly as it stresses the patellar tendon.",
  },

  // ─── CHEST (extra 2) ────────────────────────────────────────
  {
    id: "ch15", name: "Low Cable Fly", category: "Chest",
    equipment: "Cable Machine", difficulty: "Intermediate",
    primaryMuscles: ["Lower Pectorals"], secondaryMuscles: ["Front Deltoids"],
    instructions: [
      "Set both cable pulleys to the lowest position and attach single handles.",
      "Stand in the centre with one foot forward, arms extended downward at an angle.",
      "Pull the cables up and across your body, meeting at chest height.",
      "Squeeze the chest at the top, then lower slowly.",
    ],
    tips: "Low cables target the lower chest and keep tension through the entire arc.",
  },
  {
    id: "ch16", name: "Incline Cable Fly", category: "Chest",
    equipment: "Cable Machine", difficulty: "Intermediate",
    primaryMuscles: ["Upper Pectorals"], secondaryMuscles: ["Front Deltoids"],
    instructions: [
      "Set cables to the lowest position. Place an incline bench (30–45°) between the pulleys.",
      "Lie on the bench and hold the handles with a slight bend in the elbows.",
      "Pull the cables upward and inward, meeting above your upper chest.",
      "Return slowly with control.",
    ],
    tips: "Low cables plus incline angle create peak tension directly on the upper chest.",
  },
  {
    id: "ch17", name: "Machine Chest Press", category: "Chest",
    equipment: "Machine", difficulty: "Beginner",
    primaryMuscles: ["Pectorals"], secondaryMuscles: ["Triceps", "Front Deltoids"],
    instructions: [
      "Adjust the seat so the handles are at mid-chest height.",
      "Grip the handles, retract your shoulder blades, and press forward.",
      "Fully extend without locking the elbows harshly, then return with control.",
    ],
    tips: "The fixed path makes this ideal for beginners and for pre-exhausting the chest safely.",
  },
  {
    id: "ch18", name: "Close-Grip Push Up", category: "Chest",
    equipment: "Bodyweight", difficulty: "Beginner",
    primaryMuscles: ["Inner Pectorals"], secondaryMuscles: ["Triceps", "Front Deltoids"],
    instructions: [
      "Get into a push-up position with hands placed directly below your shoulders (narrower than standard).",
      "Lower your chest toward your hands keeping elbows close to your body.",
      "Push back up to full extension.",
    ],
    tips: "The narrow hand position shifts emphasis to the inner chest and triceps.",
  },
  {
    id: "ch19", name: "Landmine Press", category: "Chest",
    equipment: "Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Upper Pectorals", "Front Deltoids"], secondaryMuscles: ["Triceps", "Core"],
    instructions: [
      "Anchor one end of a barbell in a landmine attachment or a corner.",
      "Hold the free end at shoulder height with one or both hands.",
      "Press the bar forward and upward in an arc until arms are nearly extended.",
      "Return slowly.",
    ],
    tips: "The arc-like path is joint-friendly and excellent for upper chest and anterior delt development.",
  },

  // ─── BACK (extra 2) ─────────────────────────────────────────
  {
    id: "bk15", name: "Wide-Grip Lat Pulldown", category: "Back",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Lats", "Teres Major"], secondaryMuscles: ["Biceps"],
    instructions: [
      "Grip the lat pulldown bar at its widest points (well beyond shoulder-width).",
      "Lean back slightly and pull the bar to your upper chest.",
      "Squeeze your lats at the bottom, then return with control.",
    ],
    tips: "A wide grip increases the stretch on the lats at the top — great for building back width.",
  },
  {
    id: "bk16", name: "Rack Pull", category: "Back",
    equipment: "Barbell", difficulty: "Advanced",
    primaryMuscles: ["Erector Spinae", "Trapezius"], secondaryMuscles: ["Glutes", "Lats"],
    instructions: [
      "Set a barbell in a rack at knee height. Stand with feet hip-width.",
      "Grip the bar just outside your knees.",
      "Drive through your hips to pull the bar to lockout.",
      "Lower back to the rack with control.",
    ],
    tips: "Trains the top half of the deadlift — great for building a stronger lockout and upper back thickness.",
  },
  {
    id: "bk17", name: "Back Extension", category: "Back",
    equipment: "Hyperextension Machine", difficulty: "Beginner",
    primaryMuscles: ["Erector Spinae"], secondaryMuscles: ["Glutes", "Hamstrings"],
    instructions: [
      "Position yourself in the hyperextension machine with hips on the pad.",
      "Cross arms over chest or hold a plate for added resistance.",
      "Lower your torso until nearly perpendicular to the floor.",
      "Drive your hips forward to return to a straight position.",
    ],
    tips: "Avoid hyperextending past neutral — stop at a straight body line to protect the spine.",
  },
  {
    id: "bk18", name: "Dumbbell Shrug", category: "Back",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Trapezius"], secondaryMuscles: [],
    instructions: [
      "Stand holding dumbbells at your sides with arms straight.",
      "Shrug your shoulders straight up toward your ears.",
      "Pause briefly at the top, then lower with control.",
    ],
    tips: "No rolling — straight up and straight down. Slow negatives build more trap mass.",
  },

  // ─── SHOULDERS (extra 2) ────────────────────────────────────
  {
    id: "sh13", name: "Machine Shoulder Press", category: "Shoulders",
    equipment: "Machine", difficulty: "Beginner",
    primaryMuscles: ["Front Deltoids", "Lateral Deltoids"], secondaryMuscles: ["Triceps"],
    instructions: [
      "Adjust the seat so the handles start at ear level.",
      "Grip the handles and press upward until arms are nearly extended.",
      "Return slowly to the start.",
    ],
    tips: "The fixed path reduces stability demands — a good option when fatigued or rehabbing shoulders.",
  },
  {
    id: "sh14", name: "Cable Front Raise", category: "Shoulders",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Front Deltoids"], secondaryMuscles: [],
    instructions: [
      "Stand facing away from a low cable, handle in one or both hands.",
      "Raise your arm(s) forward to shoulder height.",
      "Lower slowly under constant cable tension.",
    ],
    tips: "Cables maintain tension at the bottom of the movement — better stimulus than dumbbells.",
  },
  {
    id: "sh15", name: "Rear Delt Machine Fly", category: "Shoulders",
    equipment: "Machine", difficulty: "Beginner",
    primaryMuscles: ["Rear Deltoids"], secondaryMuscles: ["Rhomboids"],
    instructions: [
      "Sit facing the pec deck machine in reverse, with arms extended forward.",
      "Pull the handles out and back in a wide arc.",
      "Squeeze your rear delts at the back of the movement.",
      "Return with control.",
    ],
    tips: "Reverse the pec deck to work the rear delts — key for balanced shoulder health and appearance.",
  },
  {
    id: "sh16", name: "Bradford Press", category: "Shoulders",
    equipment: "Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Front Deltoids", "Lateral Deltoids"], secondaryMuscles: ["Trapezius"],
    instructions: [
      "Hold a barbell at the front rack position (collarbone height).",
      "Press the bar just over the top, then immediately lower it behind your head to the traps.",
      "Press back over the top to the front — that is one rep.",
      "Alternate continuously without fully locking out.",
    ],
    tips: "Continuous tension across all three deltoid heads. Use a light weight — the volume is the stimulus.",
  },

  // ─── BICEPS (extra 2) ───────────────────────────────────────
  {
    id: "ar15", name: "Cable Curl", category: "Biceps",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Biceps"], secondaryMuscles: ["Brachialis"],
    instructions: [
      "Stand at a low cable pulley with a straight bar or EZ attachment.",
      "Keep elbows pinned at your sides and curl the bar up to shoulder height.",
      "Squeeze at the top, then lower with control.",
    ],
    tips: "The cable keeps tension at the bottom of the curl — a major advantage over free weights.",
  },
  {
    id: "ar16", name: "Spider Curl", category: "Biceps",
    equipment: "Dumbbells / Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Biceps Short Head"], secondaryMuscles: ["Brachialis"],
    instructions: [
      "Set an incline bench to 45°. Lie chest-down with arms hanging straight off the front edge.",
      "Curl the weight toward your face without moving your upper arms.",
      "Lower fully before repeating.",
    ],
    tips: "The hanging chest-down position maximises the bicep stretch — excellent for building peak.",
  },
  // ─── TRICEPS (extra 2) ──────────────────────────────────────
  {
    id: "ar17", name: "Tate Press", category: "Triceps",
    equipment: "Dumbbells", difficulty: "Intermediate",
    primaryMuscles: ["Triceps"], secondaryMuscles: [],
    instructions: [
      "Lie on a bench holding dumbbells above your chest, palms facing feet.",
      "Allow elbows to flare outward and lower the dumbbells toward your chest.",
      "Press back up by extending the elbows.",
    ],
    tips: "A unique tricep isolation — the flared elbow position hits all three heads equally.",
  },
  {
    id: "ar18", name: "Cable Overhead Tricep Extension", category: "Triceps",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Triceps Long Head"], secondaryMuscles: [],
    instructions: [
      "Stand facing away from a high cable with a rope attachment.",
      "Hold the rope behind your head, elbows bent and pointed forward.",
      "Extend your arms overhead until fully straight.",
      "Lower slowly back to the start.",
    ],
    tips: "Overhead position maximises the stretch on the tricep long head — key for arm mass.",
  },
  {
    id: "ar19", name: "Tricep Kickback", category: "Triceps",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Triceps"], secondaryMuscles: [],
    instructions: [
      "Hinge forward at the hips with upper arm parallel to the floor, dumbbell in hand.",
      "Extend the forearm back until the arm is fully straight.",
      "Squeeze the tricep hard at the end, then lower with control.",
    ],
    tips: "Lock the upper arm parallel to the floor — any movement here turns it into a row.",
  },
  // ─── BICEPS (extra 3) ───────────────────────────────────────
  {
    id: "ar20", name: "Drag Curl", category: "Biceps",
    equipment: "Barbell / Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Biceps Long Head"], secondaryMuscles: [],
    instructions: [
      "Hold the bar at hip level with an underhand grip.",
      "Rather than curling forward, drag the bar straight up your body by driving elbows back.",
      "Keep the bar close to your torso throughout the movement.",
      "Lower by reversing the motion.",
    ],
    tips: "Eliminates front deltoid involvement — targets the bicep long head and builds the peak.",
  },
  // ─── FOREARMS (extra 2) ─────────────────────────────────────
  {
    id: "ar21", name: "Cross Body Hammer Curl", category: "Forearms",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Brachialis", "Brachioradialis"], secondaryMuscles: ["Biceps"],
    instructions: [
      "Hold dumbbells at your sides with a neutral grip.",
      "Curl one dumbbell across your body toward the opposite shoulder.",
      "Alternate arms with each rep.",
    ],
    tips: "The cross-body path places peak tension on the brachialis — adds serious thickness to the arms.",
  },

  // ─── CORE (extra 2) ─────────────────────────────────────────
  {
    id: "co13", name: "Dead Bug", category: "Core",
    equipment: "Bodyweight", difficulty: "Beginner",
    primaryMuscles: ["Transverse Abdominis", "Rectus Abdominis"], secondaryMuscles: ["Hip Flexors"],
    instructions: [
      "Lie on your back with arms pointing to the ceiling and knees bent at 90°.",
      "Slowly lower one arm and the opposite leg toward the floor, keeping your lower back pressed flat.",
      "Return and repeat on the other side.",
    ],
    tips: "Exhale as you extend — this braces the core and keeps the lower back from arching.",
  },
  {
    id: "co14", name: "Mountain Climber", category: "Core",
    equipment: "Bodyweight", difficulty: "Beginner",
    primaryMuscles: ["Transverse Abdominis", "Hip Flexors"], secondaryMuscles: ["Chest", "Shoulders"],
    instructions: [
      "Start in a high plank position.",
      "Drive one knee rapidly toward your chest, then quickly switch to the other.",
      "Maintain a flat, stable back throughout.",
    ],
    tips: "Keep hips low and stable — resist the urge to bounce them with each step.",
  },
  {
    id: "co15", name: "Hollow Hold", category: "Core",
    equipment: "Bodyweight", difficulty: "Intermediate",
    primaryMuscles: ["Rectus Abdominis", "Transverse Abdominis"], secondaryMuscles: ["Hip Flexors"],
    instructions: [
      "Lie on your back with arms extended above your head.",
      "Lift your legs, head, and shoulders off the floor simultaneously.",
      "Press your lower back firmly into the floor and hold the 'banana' shape.",
      "Hold for time.",
    ],
    tips: "The foundation of gymnastics core training. Bend knees to scale the difficulty.",
  },
  {
    id: "co16", name: "Side Plank", category: "Core",
    equipment: "Bodyweight", difficulty: "Beginner",
    primaryMuscles: ["Obliques", "Lateral Core"], secondaryMuscles: ["Glutes", "Shoulders"],
    instructions: [
      "Lie on your side, resting on one forearm with feet stacked.",
      "Raise your hips until your body is in a straight line from head to feet.",
      "Hold for time, then switch sides.",
    ],
    tips: "Press the floor away with your supporting elbow to keep the shoulder stable.",
  },
  {
    id: "co17", name: "V-Up", category: "Core",
    equipment: "Bodyweight", difficulty: "Intermediate",
    primaryMuscles: ["Rectus Abdominis", "Hip Flexors"], secondaryMuscles: [],
    instructions: [
      "Lie flat on your back with arms extended above your head.",
      "Simultaneously raise your legs and torso, reaching your hands toward your feet.",
      "Lower back to the starting position with control.",
    ],
    tips: "Keep legs straight for the full challenge, or bend knees to scale.",
  },
  {
    id: "co18", name: "Cable Woodchop", category: "Core",
    equipment: "Cable Machine", difficulty: "Intermediate",
    primaryMuscles: ["Obliques"], secondaryMuscles: ["Shoulders", "Lats"],
    instructions: [
      "Set a cable to the high position. Stand side-on and hold the handle with both hands.",
      "Pull the cable diagonally downward across your body in a chopping motion.",
      "Rotate through your hips and core — not just your arms.",
      "Return slowly and repeat, then switch sides.",
    ],
    tips: "The rotational resistance trains the obliques through a full range of motion.",
  },

  // ─── LEGS (extra 2) ─────────────────────────────────────────
  {
    id: "lg15", name: "Front Squat", category: "Legs",
    equipment: "Barbell", difficulty: "Advanced",
    primaryMuscles: ["Quadriceps"], secondaryMuscles: ["Glutes", "Core"],
    instructions: [
      "Hold the barbell in a front rack position with elbows high.",
      "Stand with feet shoulder-width.",
      "Squat down keeping your torso upright — the front load demands this.",
      "Drive through your heels to return.",
    ],
    tips: "Far more quad-dominant than a back squat. Elbows must stay high to prevent the bar from falling forward.",
  },
  {
    id: "lg16", name: "Hack Squat Machine", category: "Legs",
    equipment: "Machine", difficulty: "Intermediate",
    primaryMuscles: ["Quadriceps", "Glutes"], secondaryMuscles: ["Hamstrings"],
    instructions: [
      "Step onto the hack squat machine with feet shoulder-width on the platform.",
      "Unrack the weight and lower your body until your knees are at ~90°.",
      "Drive through your heels to push back to the start.",
      "Re-rack before stepping off.",
    ],
    tips: "Foot position changes emphasis: high feet targets glutes, low feet targets quads.",
  },
  {
    id: "lg17", name: "Seated Leg Curl", category: "Legs",
    equipment: "Machine", difficulty: "Beginner",
    primaryMuscles: ["Hamstrings"], secondaryMuscles: [],
    instructions: [
      "Adjust the machine pad to rest just above your ankles when seated.",
      "Curl your legs down as far as possible.",
      "Squeeze the hamstrings at the bottom, then return slowly.",
    ],
    tips: "The seated position pre-stretches the hamstrings at the hip — slightly different stimulus than the lying version.",
  },
  {
    id: "lg18", name: "Standing Calf Raise Machine", category: "Legs",
    equipment: "Machine", difficulty: "Beginner",
    primaryMuscles: ["Gastrocnemius"], secondaryMuscles: ["Soleus"],
    instructions: [
      "Step under the shoulder pads with the balls of your feet on the footplate.",
      "Rise onto your toes as high as possible.",
      "Lower your heels below the footplate for a full stretch.",
    ],
    tips: "Calves respond best to high volume (15–25 reps) and slow, controlled tempo.",
  },
  {
    id: "lg19", name: "Step Up", category: "Legs",
    equipment: "Bodyweight / Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Quadriceps", "Glutes"], secondaryMuscles: ["Hamstrings"],
    instructions: [
      "Stand in front of a box or bench.",
      "Step up with one foot, driving through that heel to lift your entire body.",
      "Stand fully upright on the box, then step down with control.",
      "Alternate legs or complete all reps on one side first.",
    ],
    tips: "Drive through the heel of the working leg — avoid pushing off the trailing foot.",
  },
  {
    id: "lg20", name: "Walking Lunges", category: "Legs",
    equipment: "Bodyweight / Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Quadriceps", "Glutes"], secondaryMuscles: ["Hamstrings", "Core"],
    instructions: [
      "Step forward with one leg into a lunge, back knee nearly touching the floor.",
      "Drive through your front heel to bring your rear foot forward into the next lunge.",
      "Continue walking forward with each rep.",
    ],
    tips: "More demanding than stationary lunges — great for coordination and unilateral strength.",
  },
  {
    id: "lg21", name: "Smith Machine Squat", category: "Legs",
    equipment: "Smith Machine", difficulty: "Beginner",
    primaryMuscles: ["Quadriceps", "Glutes"], secondaryMuscles: ["Hamstrings"],
    instructions: [
      "Set the bar to shoulder height in the Smith machine. Step under it and unrack.",
      "Stand with feet slightly forward of the bar.",
      "Squat to parallel, keeping the bar path vertical.",
      "Drive back up and re-rack when done.",
    ],
    tips: "The fixed path allows a slightly forward foot position — good for learning squat mechanics safely.",
  },

  // ─── CARDIO (extra) ─────────────────────────────────────────
  {
    id: "ca07", name: "Battle Ropes", category: "Cardio",
    equipment: "Battle Ropes", difficulty: "Intermediate",
    primaryMuscles: ["Cardiovascular System", "Shoulders", "Arms"], secondaryMuscles: ["Core"],
    instructions: [
      "Hold one rope in each hand with feet shoulder-width apart.",
      "Alternate raising and slamming each arm to create waves.",
      "Keep your core tight and stay in an athletic squat throughout.",
      "Work in 20–40 second intervals.",
    ],
    tips: "Upper-body cardio that spares the knees — great when running is off the table.",
  },
  {
    id: "ca08", name: "Sprint Intervals", category: "Cardio",
    equipment: "Treadmill / Track", difficulty: "Advanced",
    primaryMuscles: ["Cardiovascular System", "Quads", "Hamstrings"], secondaryMuscles: ["Calves", "Glutes"],
    instructions: [
      "Warm up with 5 minutes at a moderate jog.",
      "Sprint at near-maximum effort for 20–30 seconds.",
      "Walk or jog for 60–90 seconds to recover.",
      "Repeat 6–10 rounds.",
    ],
    tips: "HIIT sprints torch calories long after the session via EPOC. Keep quality high over quantity.",
  },
  {
    id: "ca09", name: "Sled Push", category: "Cardio",
    equipment: "Weighted Sled", difficulty: "Intermediate",
    primaryMuscles: ["Quads", "Cardiovascular System"], secondaryMuscles: ["Glutes", "Calves", "Core"],
    instructions: [
      "Load the sled with an appropriate weight.",
      "Drive it forward by pushing with arms and driving powerfully with legs.",
      "Keep your back flat and head neutral.",
      "Aim for 20–30m pushes with rest periods.",
    ],
    tips: "Functional, joint-friendly cardio with serious strength and conditioning crossover.",
  },
  {
    id: "ca10", name: "Box Jump", category: "Cardio",
    equipment: "Plyo Box", difficulty: "Intermediate",
    primaryMuscles: ["Quads", "Glutes"], secondaryMuscles: ["Calves", "Hamstrings"],
    instructions: [
      "Stand in front of a plyo box, feet hip-width.",
      "Swing arms, bend knees, and explode upward.",
      "Land softly on the box with both feet flat.",
      "Step down rather than jumping down to protect the knees.",
    ],
    tips: "Train explosiveness and fast-twitch fibers. Start with a low box and progress gradually.",
  },
  // ─── CHEST (extra 3) ────────────────────────────────────────
  {
    id: "ch20", name: "Dumbbell Pullover", category: "Chest",
    equipment: "Dumbbell", difficulty: "Intermediate",
    primaryMuscles: ["Pectorals", "Lats"], secondaryMuscles: ["Triceps Long Head"],
    instructions: [
      "Lie perpendicular across a bench with upper back supported and hips low.",
      "Hold one dumbbell with both hands above your chest, arms slightly bent.",
      "Lower the dumbbell in an arc behind your head toward the floor.",
      "Pull back up to the start by squeezing your chest and lats.",
    ],
    tips: "Keep elbows fixed throughout — this is not a press. The arc is what does the work.",
  },
  {
    id: "ch21", name: "Hex Press", category: "Chest",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Inner Pectorals"], secondaryMuscles: ["Triceps"],
    instructions: [
      "Lie on a flat bench holding two dumbbells together horizontally above your chest.",
      "Press the dumbbells firmly against each other throughout the movement.",
      "Lower them to your chest while maintaining inward pressure.",
      "Press back to the start.",
    ],
    tips: "The constant inward squeeze is what makes this effective for inner chest activation.",
  },
  {
    id: "ch22", name: "Incline Dumbbell Fly", category: "Chest",
    equipment: "Dumbbells", difficulty: "Intermediate",
    primaryMuscles: ["Upper Pectorals"], secondaryMuscles: ["Front Deltoids"],
    instructions: [
      "Set a bench to 30–45°. Hold dumbbells above your upper chest, palms facing each other.",
      "With a slight bend in the elbows, lower the weights in a wide arc.",
      "Stop when you feel a deep stretch in the upper chest.",
      "Squeeze back to the start.",
    ],
    tips: "The stretch at the bottom is where the growth happens — don't rush through it.",
  },
  {
    id: "ch23", name: "Plyo Push Up", category: "Chest",
    equipment: "Bodyweight", difficulty: "Advanced",
    primaryMuscles: ["Pectorals"], secondaryMuscles: ["Triceps", "Front Deltoids"],
    instructions: [
      "Start in a standard push-up position.",
      "Lower your chest to the floor.",
      "Explode upward with enough force that your hands leave the floor.",
      "Land softly and immediately go into the next rep.",
    ],
    tips: "Develops explosive chest power. Build to this from standard push-ups — form must be perfect first.",
  },

  // ─── BACK (extra 3) ─────────────────────────────────────────
  {
    id: "bk19", name: "Meadows Row", category: "Back",
    equipment: "Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Lats", "Teres Major"], secondaryMuscles: ["Biceps", "Rear Deltoids"],
    instructions: [
      "Anchor one end of a barbell in a landmine sleeve or corner.",
      "Stand at the free end perpendicular to the bar. Hinge forward and grip the bar with a pronated grip.",
      "Row the bar toward your hip, driving elbow high and back.",
      "Lower with control.",
    ],
    tips: "The angled pull targets the outer sweep of the lats more than a conventional row.",
  },
  {
    id: "bk20", name: "Inverted Row", category: "Back",
    equipment: "Barbell / TRX", difficulty: "Beginner",
    primaryMuscles: ["Rhomboids", "Rear Deltoids"], secondaryMuscles: ["Biceps"],
    instructions: [
      "Set a barbell in a rack at hip height. Lie underneath it, gripping the bar with an overhand grip.",
      "Keep your body in a straight line from heels to head.",
      "Pull your chest up to the bar by squeezing shoulder blades together.",
      "Lower with control.",
    ],
    tips: "Bend knees or elevate feet to adjust difficulty. A great horizontal pull alternative to rows.",
  },
  {
    id: "bk21", name: "Seal Row", category: "Back",
    equipment: "Barbell / Dumbbells", difficulty: "Intermediate",
    primaryMuscles: ["Lats", "Rhomboids"], secondaryMuscles: ["Biceps"],
    instructions: [
      "Set up an elevated flat bench. Lie face-down with chest overhanging the edge.",
      "Hold the barbell or dumbbells at full arm extension directly below you.",
      "Row the weight to your abdomen, squeezing shoulder blades at the top.",
      "Lower fully before repeating.",
    ],
    tips: "Chest support completely removes the lower back and momentum — pure back isolation.",
  },
  {
    id: "bk22", name: "Snatch-Grip Deadlift", category: "Back",
    equipment: "Barbell", difficulty: "Advanced",
    primaryMuscles: ["Traps", "Erector Spinae", "Lats"], secondaryMuscles: ["Glutes", "Hamstrings"],
    instructions: [
      "Take a very wide overhand grip on the barbell (much wider than a conventional deadlift).",
      "Hinge to the bar — the wide grip means you start in a lower position.",
      "Maintain a neutral spine and drive through the heels to lockout.",
      "Lower with control.",
    ],
    tips: "The extra range of motion and wider grip tax the upper back and traps more than any other deadlift variation.",
  },

  // ─── SHOULDERS (extra 3) ────────────────────────────────────
  {
    id: "sh17", name: "Plate Front Raise", category: "Shoulders",
    equipment: "Weight Plate", difficulty: "Beginner",
    primaryMuscles: ["Front Deltoids"], secondaryMuscles: [],
    instructions: [
      "Stand holding a weight plate at the 3 and 9 o'clock positions.",
      "With straight arms and a slight elbow bend, raise the plate forward to eye level.",
      "Lower slowly.",
    ],
    tips: "The grip width forces a neutral wrist position that feels more natural than a dumbbell front raise.",
  },
  {
    id: "sh18", name: "Landmine Lateral Raise", category: "Shoulders",
    equipment: "Barbell", difficulty: "Intermediate",
    primaryMuscles: ["Lateral Deltoids"], secondaryMuscles: ["Front Deltoids"],
    instructions: [
      "Anchor a barbell in a landmine attachment. Hold the free end with one hand at your side.",
      "Raise the bar in a sweeping lateral arc to shoulder height.",
      "Return slowly.",
    ],
    tips: "The arc path of the landmine maintains more tension at the top than a standard lateral raise.",
  },
  {
    id: "sh19", name: "Prone Y-T-W Raise", category: "Shoulders",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Rear Deltoids", "Lower Traps", "Rhomboids"], secondaryMuscles: ["Rotator Cuff"],
    instructions: [
      "Lie face-down on an incline bench. Hold light dumbbells.",
      "Y: raise arms overhead at 30°. T: raise arms straight out to sides. W: pull elbows back with arms bent at 90°.",
      "Perform each shape slowly with a squeeze at the top.",
    ],
    tips: "Use very light weight — these are corrective/prehab exercises, not strength work.",
  },
  {
    id: "sh20", name: "Cable Rear Delt Pull", category: "Shoulders",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Rear Deltoids"], secondaryMuscles: ["Rhomboids", "Traps"],
    instructions: [
      "Set a cable to head height. Stand facing the machine, grab the handle with the opposite hand.",
      "Pull the handle across your body in a wide arc, keeping the arm straight.",
      "Reverse and repeat, then switch sides.",
    ],
    tips: "A unilateral rear delt isolation that is easy to load progressively and feel clearly.",
  },

  // ─── BICEPS (extra 4) ───────────────────────────────────────
  {
    id: "ar22", name: "Zottman Curl", category: "Biceps",
    equipment: "Dumbbells", difficulty: "Intermediate",
    primaryMuscles: ["Biceps"], secondaryMuscles: ["Brachialis", "Brachioradialis"],
    instructions: [
      "Hold dumbbells with a supinated grip (palms up). Curl to the top.",
      "At the top, rotate your wrists so palms face downward.",
      "Lower in this pronated position (reverse curl).",
      "Rotate back to supinated at the bottom for the next rep.",
    ],
    tips: "Trains biceps on the way up and forearms on the way down in one movement.",
  },
  {
    id: "ar23", name: "Waiter Curl", category: "Biceps",
    equipment: "Dumbbell", difficulty: "Beginner",
    primaryMuscles: ["Biceps Long Head"], secondaryMuscles: [],
    instructions: [
      "Hold one dumbbell vertically with both hands — cradle the top plate like holding a tray.",
      "Keep elbows tucked at your sides and curl the dumbbell up.",
      "Squeeze hard at the top, then lower slowly.",
    ],
    tips: "The supinated wrist position creates a stronger bicep peak contraction than a standard curl.",
  },
  {
    id: "ar24", name: "Cable Hammer Curl", category: "Biceps",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Brachialis", "Brachioradialis"], secondaryMuscles: ["Biceps"],
    instructions: [
      "Attach a rope to a low cable. Hold it with a neutral (palms-in) grip.",
      "Curl the rope upward without rotating your wrists.",
      "Squeeze at the top, then lower with control.",
    ],
    tips: "Cables keep constant tension on the brachialis — a key muscle for arm thickness.",
  },
  {
    id: "ar25", name: "Prone Incline Curl", category: "Biceps",
    equipment: "Dumbbells", difficulty: "Intermediate",
    primaryMuscles: ["Biceps"], secondaryMuscles: ["Brachialis"],
    instructions: [
      "Set a bench to 45°. Lie face-down with arms hanging straight below.",
      "Curl both dumbbells up to shoulder height.",
      "Lower fully to a dead hang before each rep.",
    ],
    tips: "Gravity-assisted stretch at the bottom with strict elbow position — great for consistent overload.",
  },

  // ─── TRICEPS (extra 3) ──────────────────────────────────────
  {
    id: "ar26", name: "JM Press", category: "Triceps",
    equipment: "Barbell / EZ Bar", difficulty: "Advanced",
    primaryMuscles: ["Triceps"], secondaryMuscles: ["Pectorals"],
    instructions: [
      "Lie on a flat bench and unrack the bar with a shoulder-width grip.",
      "Lower the bar in a controlled arc toward your neck/upper chest, allowing elbows to flare slightly.",
      "Just before the bar touches, press back up explosively.",
    ],
    tips: "A hybrid between a close-grip bench press and a skull crusher. Heavy but joint-intensive — warm up thoroughly.",
  },
  {
    id: "ar27", name: "Dumbbell Floor Press", category: "Triceps",
    equipment: "Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Triceps"], secondaryMuscles: ["Pectorals", "Front Deltoids"],
    instructions: [
      "Lie on the floor with knees bent. Hold dumbbells at chest height.",
      "Press upward to full extension.",
      "Lower until your upper arms rest on the floor, then press again.",
    ],
    tips: "The floor limits the range of motion, placing more tension on the lockout — the tricep-dominant phase.",
  },
  {
    id: "ar28", name: "Single-Arm Tricep Pushdown", category: "Triceps",
    equipment: "Cable Machine", difficulty: "Beginner",
    primaryMuscles: ["Triceps"], secondaryMuscles: [],
    instructions: [
      "Stand at a high cable with a single D-handle. Grip with one hand, elbow pinned at your side.",
      "Push the handle straight down until your arm is fully extended.",
      "Return slowly, then switch arms.",
    ],
    tips: "Unilateral training reveals and corrects strength imbalances between arms.",
  },

  // ─── FOREARMS (extra 3) ─────────────────────────────────────
  {
    id: "ar29", name: "Wrist Curl", category: "Forearms",
    equipment: "Barbell / Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Wrist Flexors"], secondaryMuscles: [],
    instructions: [
      "Sit on a bench with forearms resting on your thighs, palms facing up.",
      "Hold a barbell with an underhand grip, wrists hanging off the knees.",
      "Curl your wrists upward as far as possible.",
      "Lower slowly back to full extension.",
    ],
    tips: "Train wrists through a full range — extend fully at the bottom to stretch the flexors.",
  },
  {
    id: "ar30", name: "Reverse Wrist Curl", category: "Forearms",
    equipment: "Barbell / Dumbbells", difficulty: "Beginner",
    primaryMuscles: ["Wrist Extensors"], secondaryMuscles: ["Brachioradialis"],
    instructions: [
      "Sit with forearms on your thighs, palms facing down, wrists hanging over the knees.",
      "Extend your wrists upward as far as possible.",
      "Lower slowly.",
    ],
    tips: "Balances wrist flexor training — essential for preventing elbow tendon issues.",
  },
  {
    id: "ar31", name: "Farmer's Carry", category: "Forearms",
    equipment: "Dumbbells / Kettlebells", difficulty: "Beginner",
    primaryMuscles: ["Grip", "Forearms"], secondaryMuscles: ["Traps", "Core"],
    instructions: [
      "Pick up heavy dumbbells or kettlebells in each hand.",
      "Stand tall with shoulders packed and walk for a set distance or time.",
      "Set down with control.",
    ],
    tips: "One of the best overall strength exercises — grip, core, traps, and mental fortitude all in one.",
  },
  {
    id: "ar32", name: "Plate Pinch", category: "Forearms",
    equipment: "Weight Plate", difficulty: "Beginner",
    primaryMuscles: ["Grip", "Finger Flexors"], secondaryMuscles: ["Forearms"],
    instructions: [
      "Pinch one or two weight plates between your thumb and fingers (smooth side out).",
      "Hold at your side for time, then switch hands.",
    ],
    tips: "Specifically trains pinch grip — weak pinch grip often limits other pulling movements.",
  },

  {
    id: "ca11", name: "Elliptical", category: "Cardio",
    equipment: "Elliptical Machine", difficulty: "Beginner",
    primaryMuscles: ["Cardiovascular System", "Legs"], secondaryMuscles: ["Arms"],
    instructions: [
      "Set resistance and incline to your target level.",
      "Push and pull the arm handles to engage upper body.",
      "Maintain a smooth, continuous stride.",
      "Aim for a steady pace at your target heart rate.",
    ],
    tips: "Very low impact on joints — an excellent cardio option for those with knee or hip issues.",
  },
  {
    id: "ca12", name: "Swimming", category: "Cardio",
    equipment: "Swimming Pool", difficulty: "Beginner",
    primaryMuscles: ["Cardiovascular System", "Shoulders", "Back"], secondaryMuscles: ["Core", "Legs"],
    instructions: [
      "Choose your stroke (freestyle, breaststroke, backstroke).",
      "Warm up with slow laps, then build your pace.",
      "Focus on breathing rhythm — exhale underwater, inhale to the side.",
      "Cool down with gentle kicking.",
    ],
    tips: "Full-body cardio with zero impact on the joints. Excellent for active recovery days.",
  },
  {
    id: "ca13", name: "Assault Bike", category: "Cardio",
    equipment: "Assault Bike", difficulty: "Intermediate",
    primaryMuscles: ["Cardiovascular System", "Legs", "Arms"], secondaryMuscles: ["Core"],
    instructions: [
      "Adjust the seat so your knee has a slight bend at the bottom of the pedal stroke.",
      "Grip the handles and drive with both arms and legs simultaneously.",
      "Alternate between all-out intervals and recovery periods.",
    ],
    tips: "The assault bike is brutally effective — even 10-minute sessions provide serious conditioning.",
  },
  {
    id: "ca14", name: "Outdoor Running", category: "Cardio",
    equipment: "None", difficulty: "Beginner",
    primaryMuscles: ["Cardiovascular System", "Legs"], secondaryMuscles: ["Core"],
    instructions: [
      "Start with a 2–3 minute walk warm-up.",
      "Run at a comfortable, conversational pace.",
      "Keep shoulders relaxed and arms at ~90°.",
      "Cool down with a walk and light stretching.",
    ],
    tips: "Running outdoors improves balance and proprioception — more mentally stimulating than a treadmill.",
  },
];

export function getExercisesByCategory(category) {
  return EXERCISES.filter((e) => e.category === category);
}

export function searchExercises(query) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return EXERCISES;
  return EXERCISES.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.equipment.toLowerCase().includes(q) ||
      e.primaryMuscles.some((m) => m.toLowerCase().includes(q))
  );
}

export const CATEGORIES = Object.keys(CATEGORY_COLORS);
