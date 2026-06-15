import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { navigationRef } from "./navigationRef";

const TAB_NAMES = new Set(["Dashboard", "Fitness", "Tracking", "Food", "Social", "Chat"]);

function stepNavigate(tab) {
  if (!navigationRef.current) return;
  try {
    if (tab === "Dashboard") {
      // Always land on the root of DashboardStack, popping any pushed screens
      navigationRef.current.navigate("Main", { screen: "Dashboard", params: { screen: "DashboardMain" } });
    } else if (TAB_NAMES.has(tab)) {
      navigationRef.current.navigate("Main", { screen: tab });
    } else if (tab === "Profile") {
      navigationRef.current.navigate("Main", { screen: "Dashboard", params: { screen: "Profile" } });
    } else if (tab === "Settings") {
      navigationRef.current.navigate("Main", { screen: "Dashboard", params: { screen: "Settings" } });
    }
  } catch {}
}

const MAIN_KEY    = (uid) => `sff_tour_done_${uid || "guest"}`;
const PLANS_KEY   = (uid) => `sff_tour_plans_${uid || "guest"}`;
const LOGFOOD_KEY = (uid) => `sff_tour_logfood_${uid || "guest"}`;

// ─── Main tour steps (24) ─────────────────────────────────────────────────────

export const TOUR_STEPS = [
  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    key: "dash_overview",
    tab: "Dashboard",
    target: "dash_overview",
    title: "Calorie & Macro Rings",
    description:
      "The donut chart shows how close you are to your daily calorie goal. The three rings track your Protein, Carbs, and Fat — each fills up as you log meals throughout the day.",
  },
  {
    key: "dash_actions",
    tab: "Dashboard",
    target: "dash_actions",
    title: "Quick Actions",
    description:
      "\"Log Food\" opens the food search, \"Workout\" starts today's session from your active plan, and \"Progress\" jumps straight to your tracking charts. Tap any shortcut to get going fast.",
  },
  {
    key: "dash_insight",
    tab: "Dashboard",
    target: "dash_insight",
    title: "Weekly Insight",
    description:
      "An AI-generated summary of your week based on your food logs and workout activity. The more you log, the more personalised this gets.",
  },
  {
    key: "dash_editor",
    tab: "Dashboard",
    target: "dash_editor",
    title: "Customise Your Dashboard",
    description:
      "Tap the grid icon to enter edit mode — reorder, add, or remove widgets so your most important info is always front and centre.",
  },
  // ── Fitness ────────────────────────────────────────────────────────────────
  {
    key: "fitness_home",
    tab: "Fitness",
    target: "fitness_home",
    title: "Fitness Features",
    description:
      "\"Encyclopedia\" has hundreds of exercises with full instructions and video demos. \"Plans\" lets you browse and follow structured workout plans. \"History\" shows every session you've ever logged.",
  },
  {
    key: "fitness_activity",
    tab: "Fitness",
    target: "fitness_activity",
    title: "Today's Activity",
    description:
      "Live data from your Apple Watch or iPhone — step count, active calories burned, and heart rate, all in one glance. Tap to see the full activity breakdown.",
  },
  {
    key: "fitness_weight",
    tab: "Fitness",
    target: "fitness_weight",
    title: "Weight Tracking",
    description:
      "Log your body weight and view your trend over time. Tap here to open the weight charts, add a new reading, or connect a smart scale.",
  },
  {
    key: "fitness_schedule",
    tab: "Fitness",
    target: "fitness_schedule",
    title: "Workout Schedule",
    description:
      "A calendar showing your planned training days based on your active workout plan. Dots mark workout days — tap any date to see what's scheduled.",
  },
  {
    key: "fitness_next",
    tab: "Fitness",
    target: "fitness_next",
    title: "Next Session",
    description:
      "Shows the upcoming session from your active plan with a full exercise list. Tap \"Start Workout\" to begin logging sets, reps, and weight live.",
  },
  // ── Food ───────────────────────────────────────────────────────────────────
  {
    key: "food_log_btn",
    tab: "Food",
    target: "food_log_btn",
    title: "Log Food",
    description:
      "Tap here to search thousands of foods, scan a barcode, or take a photo for AI recognition. Enter your portion size and your macros update instantly.",
  },
  {
    key: "food_log",
    tab: "Food",
    target: "food_log",
    title: "Today's Food Log",
    description:
      "Everything you've eaten today — food name, weight, and calories per entry. Swipe an entry to delete it. Your running calorie total shows at the bottom.",
  },
  {
    key: "food_water",
    tab: "Food",
    target: "food_water",
    title: "Water Intake",
    description:
      "Track how much water you've had today. Tap the ring to log a drink using the quick presets or enter a custom amount. Your daily target is calculated from your body weight.",
  },
  {
    key: "food_macros",
    tab: "Food",
    target: "food_macros",
    title: "Macros & Micronutrients",
    description:
      "Progress bars for Protein, Carbs, Fat, and Calories against your daily goals. Scroll down for a full micronutrient breakdown — vitamins, minerals, and more.",
  },
  {
    key: "food_recipes",
    tab: "Food",
    target: "food_recipes",
    title: "Find Recipes",
    description:
      "Browse recipes filtered by your macro goals and dietary preferences — a great starting point when you're not sure what to cook next.",
  },
  // ── Tracking ───────────────────────────────────────────────────────────────
  {
    key: "tracking_body",
    tab: "Tracking",
    target: "tracking_body",
    title: "Body Tracking",
    description:
      "Log and chart your weight, body fat %, muscle mass, and BMI over time. Tap to view trend graphs or connect a smart scale for automatic readings.",
  },
  {
    key: "tracking_food",
    tab: "Tracking",
    target: "tracking_food",
    title: "Nutrition Tracking",
    description:
      "Detailed charts for your calorie intake, macros (protein, carbs, fat), micronutrients, and water consumption — all plotted over daily, weekly, and monthly views.",
  },
  {
    key: "tracking_workout",
    tab: "Tracking",
    target: "tracking_workout",
    title: "Workout Tracking",
    description:
      "See your training frequency, session duration, total volume lifted, and personal records over time. Great for spotting your most productive weeks.",
  },
  {
    key: "tracking_activity",
    tab: "Tracking",
    target: "tracking_activity",
    title: "Activity Tracking",
    description:
      "Step counts, active calories, and heart rate data from your Apple Watch or iPhone, plotted as trends so you can see how active your weeks really are.",
  },
  // ── Social ─────────────────────────────────────────────────────────────────
  {
    key: "social_home",
    tab: "Social",
    target: "social_home",
    title: "Social Hub",
    description:
      "Connect with friends, share milestones, and keep each other accountable. See friend requests in the Friends tab, check direct messages, or browse the FAQ for common questions.",
  },
  // ── Chat ───────────────────────────────────────────────────────────────────
  {
    key: "chat_home",
    tab: "Chat",
    target: "chat_home",
    title: "AI Assistant",
    description:
      "Your personal nutrition and fitness coach. Ask anything — meal suggestions, workout tips, recipe ideas, or how to hit your macros. It uses your profile data to give personalised answers.",
  },
  // ── Dashboard (return) ─────────────────────────────────────────────────────
  {
    key: "dash_notifications",
    tab: "Dashboard",
    target: "dash_notifications",
    title: "Notifications",
    description:
      "Tap the bell to see all your notifications — workout reminders, food logging nudges, friend requests, and streak alerts. The badge shows how many are unread.",
  },
  {
    key: "dash_profile",
    tab: "Dashboard",
    target: "dash_profile",
    title: "Your Profile",
    description:
      "Tap your avatar to open your profile — view your stats, edit personal info, update your fitness aims, and manage your privacy settings.",
  },
  // ── Profile ────────────────────────────────────────────────────────────────
  {
    key: "profile_home",
    tab: "Profile",
    target: "profile_home",
    title: "Profile Overview",
    description:
      "Your public-facing page showing your display name, badge, workout streak, and key stats. Tap the pencil icon on any section to edit your personal info, body type, or fitness aims.",
  },
  // ── Settings ───────────────────────────────────────────────────────────────
  {
    key: "settings_home",
    tab: "Settings",
    target: "settings_home",
    title: "Settings",
    description:
      "Toggle dark mode, set your preferred units (kg / lbs, ft / m), manage notification reminders for workouts and food logging, control your privacy, and replay this guide anytime.",
  },
];

// ─── Workout Plans mini-tour ──────────────────────────────────────────────────

export const PLANS_TOUR_STEPS = [
  {
    key: "plans_source_tabs",
    target: "plans_source_tabs",
    title: "Browse by Source",
    description:
      "Switch between All Plans, Recommended (personalised for your level and goals), and My Plans (your active and custom plans).",
  },
  {
    key: "plans_filters",
    target: "plans_filters",
    title: "Filter by Level & Goal",
    description:
      "Use these filters to narrow plans by fitness level (Beginner, Intermediate, Advanced) and your primary training goal.",
  },
  {
    key: "plans_cards",
    target: "plans_cards",
    title: "Plan Cards",
    description:
      "Each card shows the plan name, difficulty, days per week, and a short description. Tap any card to read full details and activate the plan.",
  },
  {
    key: "plans_active",
    target: "plans_active",
    title: "Your Active Plan",
    description:
      "Your currently selected plan appears here. You can swap plans anytime — your workout history is always kept regardless of which plan is active.",
  },
];

// ─── Log Food mini-tour ───────────────────────────────────────────────────────

export const LOGFOOD_TOUR_STEPS = [
  {
    key: "logfood_scan",
    target: "logfood_scan",
    title: "Scan or Photograph",
    description:
      "Tap the camera icon to photograph your meal — AI will identify the foods and estimate portions automatically. You can also scan a barcode for an exact match from our database.",
  },
  {
    key: "logfood_search",
    target: "logfood_search",
    title: "Search for Food",
    description:
      "Type any food name to search our database of thousands of items. Results show calories and macros per 100 g — tap an item to set your portion and log it.",
  },
  {
    key: "logfood_list",
    target: "logfood_list",
    title: "Recent & Popular",
    description:
      "\"Popular\" shows commonly logged foods for quick access. Switch to \"Recent\" to re-log something you've eaten before — no typing needed.",
  },
];

// ─── Context ──────────────────────────────────────────────────────────────────

const TourCtx = createContext(null);

// tourMode: null | "main" | "plans" | "logfood"
export function TourProvider({ children, userId }) {
  const [tourMode, setTourMode] = useState(null);
  const [stepIdx,  setStepIdx]  = useState(0);

  const targets    = useRef({});
  const contentYs  = useRef({});
  const remeasures = useRef({});
  const scrollRefs = useRef({});

  const registerTarget    = useCallback((key, layout) => { targets.current[key] = layout; }, []);
  const registerContentY  = useCallback((key, y)      => { contentYs.current[key] = y; }, []);
  const registerRemeasure = useCallback((key, fn)      => { remeasures.current[key] = fn; }, []);
  const registerScroll    = useCallback((tab, ref)     => { scrollRefs.current[tab] = ref; }, []);

  const getTargetLayout = useCallback((key) => targets.current[key]   || null, []);
  const getContentY     = useCallback((key) => contentYs.current[key] ?? null, []);
  const getScrollRef    = useCallback((tab) => scrollRefs.current[tab] || null, []);
  const remeasureTarget = useCallback((key) => remeasures.current[key]?.(), []);

  const currentSteps = tourMode === "plans"   ? PLANS_TOUR_STEPS
                     : tourMode === "logfood" ? LOGFOOD_TOUR_STEPS
                     : TOUR_STEPS;

  const storageKey = useCallback((mode) => {
    if (mode === "plans")   return PLANS_KEY(userId);
    if (mode === "logfood") return LOGFOOD_KEY(userId);
    return MAIN_KEY(userId);
  }, [userId]);

  const endTour = useCallback(async () => {
    const key = storageKey(tourMode);
    setTourMode(null);
    try { await AsyncStorage.setItem(key, "1"); } catch {}
  }, [tourMode, storageKey]);

  const nextStep = useCallback(() => {
    const steps = tourMode === "plans"   ? PLANS_TOUR_STEPS
                : tourMode === "logfood" ? LOGFOOD_TOUR_STEPS
                : TOUR_STEPS;
    const next = stepIdx + 1;
    if (next >= steps.length) { endTour(); return; }
    setStepIdx(next);
    if (tourMode === "main" || tourMode === null) {
      stepNavigate(steps[next].tab);
    }
  }, [stepIdx, tourMode, endTour]);

  // Main tour
  const startTour = useCallback(async () => {
    try {
      const done = await AsyncStorage.getItem(MAIN_KEY(userId));
      if (done === "1") return;
    } catch {}
    setStepIdx(0);
    setTourMode("main");
    stepNavigate(TOUR_STEPS[0].tab);
  }, [userId]);

  const resetTour = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(MAIN_KEY(userId));
      await AsyncStorage.removeItem(PLANS_KEY(userId));
      await AsyncStorage.removeItem(LOGFOOD_KEY(userId));
    } catch {}
    setStepIdx(0);
    setTourMode("main");
    stepNavigate(TOUR_STEPS[0].tab);
  }, [userId]);

  // Plans sub-tour
  const startPlansTour = useCallback(async () => {
    try {
      const done = await AsyncStorage.getItem(PLANS_KEY(userId));
      if (done === "1") return;
    } catch {}
    setStepIdx(0);
    setTourMode("plans");
  }, [userId]);

  // LogFood sub-tour
  const startLogFoodTour = useCallback(async () => {
    try {
      const done = await AsyncStorage.getItem(LOGFOOD_KEY(userId));
      if (done === "1") return;
    } catch {}
    setStepIdx(0);
    setTourMode("logfood");
  }, [userId]);

  const active = tourMode !== null;

  return (
    <TourCtx.Provider value={{
      active, stepIdx, tourMode, currentSteps,
      startTour, resetTour, nextStep, endTour,
      startPlansTour, startLogFoodTour,
      registerTarget, registerContentY, registerRemeasure, registerScroll,
      getTargetLayout, getContentY, getScrollRef, remeasureTarget,
    }}>
      {children}
    </TourCtx.Provider>
  );
}

export function useTour() {
  return useContext(TourCtx);
}
