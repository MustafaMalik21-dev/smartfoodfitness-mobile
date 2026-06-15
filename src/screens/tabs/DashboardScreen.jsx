/**
 * DashboardScreen — modular, user-customisable home screen.
 *
 * Pinned:  Calorie / Macro card (always at top)
 * Widgets: quickActions · steps · caloriesBurned · water ·
 *          activityStats · weeklyInsight
 *
 * Quick Actions: up to 5 shortcuts chosen from a 12-item catalogue,
 *               saved per-user in AsyncStorage.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";
import {
  checkFoodReminder,
  checkStreakReminder,
  checkWorkoutReminder,
} from "../../utils/notificationScheduler";
import TourTarget from "../../tour/TourTarget";
import { useTour } from "../../tour/TourContext";
import NotificationBell from "../../components/NotificationBell";
import ProfileButton from "../../components/ProfileButton";
import {
  HK_AVAILABLE,
  getTodaySteps,
  getTodayCalories,
} from "../../utils/HealthKitService";

// ─── Constants ────────────────────────────────────────────────────────────────
const STEP_GOAL     = 10000;
const WATER_GOAL_ML = 2500;
const MAX_ACTIONS   = 5;

// Water ring geometry (matches FoodScreen proportions, scaled down)
const WR_SIZE = 120;
const WR_R    = 46;
const WR_SW   = 9;
const WR_CIRC = 2 * Math.PI * WR_R;

const WATER_PRESETS = [
  { label: "Glass",  ml: 200 },
  { label: "Can",    ml: 330 },
  { label: "Bottle", ml: 500 },
  { label: "Large",  ml: 750 },
];

// ─── Quick-action catalogue (12 destinations) ─────────────────────────────────
// Cross-tab navigation: use getParent("MainTabs") to target the Tab navigator
// directly regardless of nesting depth.  This keeps back-button behaviour
// inside the destination tab's own stack and leaves the Dashboard stack untouched.
function xNav(n, tab, screen) {
  // getParent("MainTabs") walks up to the Tab.Navigator with id="MainTabs" no
  // matter how many stack levels deep we are.
  const tabNav = n.getParent("MainTabs");
  if (tabNav) {
    tabNav.navigate(tab, screen ? { screen } : undefined);
  } else {
    // Fallback: plain navigate (will at least open the right screen)
    n.navigate(tab, screen ? { screen } : undefined);
  }
}

const ALL_ACTIONS = [
  { id: "logFood",          label: "Log Food",    icon: "restaurant-outline",  color: "#f97316",
    nav: (n) => xNav(n, "Food", "LogFood") },
  { id: "workout",          label: "Workout",     icon: "barbell-outline",     color: "#22c55e",
    nav: (n) => xNav(n, "Fitness", "Workout") },
  { id: "findRecipes",      label: "Recipes",     icon: "book-outline",        color: "#f59e0b",
    nav: (n) => xNav(n, "Food", "FindRecipes") },
  { id: "encyclopedia",     label: "Exercises",   icon: "library-outline",     color: "#6366f1",
    nav: (n) => xNav(n, "Fitness", "ExerciseEncyclopedia") },
  { id: "plans",            label: "Plans",       icon: "list-outline",        color: "#8b5cf6",
    nav: (n) => xNav(n, "Fitness", "WorkoutPlans") },
  { id: "workoutHistory",   label: "History",     icon: "time-outline",        color: "#0ea5e9",
    nav: (n) => xNav(n, "Fitness", "WorkoutHistory") },
  { id: "weightTracking",   label: "Lift Log",    icon: "barbell-outline",     color: "#0b84ff",
    nav: (n) => xNav(n, "Fitness", "WeightTracking") },
  { id: "bodyTracking",     label: "Body Track",  icon: "body-outline",        color: "#22c55e",
    nav: (n) => xNav(n, "Tracking", "BodyTracking") },
  { id: "bodyMeasurements", label: "Measures",    icon: "resize-outline",      color: "#8b5cf6",
    nav: (n) => xNav(n, "Tracking", "BodyMeasurements") },
  { id: "foodTracking",     label: "Food Stats",  icon: "nutrition-outline",   color: "#f59e0b",
    nav: (n) => xNav(n, "Tracking", "FoodTracking") },
  { id: "workoutTracking",  label: "W. Tracking", icon: "analytics-outline",   color: "#6366f1",
    nav: (n) => xNav(n, "Tracking", "WorkoutTracking") },
  { id: "activityTracking", label: "Activity",    icon: "footsteps-outline",   color: "#ef4444",
    nav: (n) => xNav(n, "Tracking", "ActivityTracking") },
];
const DEFAULT_ACTIONS = ["logFood", "workout", "findRecipes"];

// ─── Widget catalogue ─────────────────────────────────────────────────────────
const ALL_WIDGETS = [
  { id: "quickActions",   title: "Quick Actions",    desc: "Up to 5 customisable shortcuts",          icon: "flash-outline",       color: "#6366f1" },
  { id: "caloriesBurned", title: "Calories Burned",  desc: "Active kcal burned today via Apple Watch", icon: "flame-outline",       color: "#ef4444", requiresHK: true },
  { id: "steps",          title: "Step Tracker",     desc: "Today's steps from Apple Health",          icon: "footsteps-outline",   color: "#22c55e", requiresHK: true },
  { id: "water",          title: "Water Tracker",    desc: "Quick-log daily water intake",             icon: "water-outline",       color: "#0ea5e9" },
  { id: "activityStats",  title: "Activity Stats",   desc: "Total workout time and weekly frequency",  icon: "analytics-outline",   color: "#f97316" },
  { id: "weeklyInsight",  title: "Weekly Insight",   desc: "AI-powered summary of your progress",      icon: "sparkles-outline",    color: "#8b5cf6" },
];
const DEFAULT_LAYOUT  = ["quickActions", "weeklyInsight"];

// ─── Storage keys ─────────────────────────────────────────────────────────────
const layoutKey  = (uid) => `sff_dashboard_layout_v2_${uid}`;
const actionsKey = (uid) => `sff_quick_actions_v1_${uid}`;

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function toN(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmt(n) { return Math.round(toN(n)).toString(); }

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ─── SVG primitives ───────────────────────────────────────────────────────────
function MiniRing({ current, goal, color, size = 48, stroke = 7 }) {
  const { colors } = useTheme();
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const g    = Math.max(0, toN(goal));
  const off  = g ? circ * (1 - clamp(toN(current) / g, 0, 1)) : circ;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size/2} cy={size/2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
      <Circle cx={size/2} cy={size/2} r={r} stroke={color}         strokeWidth={stroke} fill="none"
        strokeDasharray={`${circ}`} strokeDashoffset={off}
        strokeLinecap="round" rotation="-90" origin={`${size/2},${size/2}`} />
    </Svg>
  );
}

function DonutChart({ percent, size = 130 }) {
  const { colors } = useTheme();
  const stroke = 13;
  const r      = (size - stroke) / 2;
  const circ   = 2 * Math.PI * r;
  const p      = clamp(toN(percent), 0, 100);
  const off    = circ * (1 - p / 100);
  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={size/2} cy={size/2} r={r} stroke={colors.border}  strokeWidth={stroke} fill="none" />
        <Circle cx={size/2} cy={size/2} r={r} stroke={colors.primary} strokeWidth={stroke} fill="none"
          strokeDasharray={`${circ}`} strokeDashoffset={off}
          strokeLinecap="round" rotation="-90" origin={`${size/2},${size/2}`} />
      </Svg>
      <View style={{ position: "absolute", top: 0, left: 0, width: size, height: size,
        alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: font.xl, fontWeight: font.bold, color: colors.text }}>{Math.round(p)}%</Text>
        <Text style={{ fontSize: 10, color: colors.textSecondary }}>of goal</Text>
      </View>
    </View>
  );
}

// ─── Widget: Quick Actions ────────────────────────────────────────────────────
function QuickActionsWidget({ navigation, activeActions, editMode, onCustomizePress, s, colors }) {
  const actions = activeActions.map((id) => ALL_ACTIONS.find((a) => a.id === id)).filter(Boolean);
  return (
    <TourTarget tourKey="dash_actions">
      <View style={s.widgetCard}>
        <View style={s.widgetHeader}>
          <View style={[s.widgetIconWrap, { backgroundColor: "#6366f115" }]}>
            <Ionicons name="flash-outline" size={17} color="#6366f1" />
          </View>
          <Text style={s.widgetTitle}>Quick Actions</Text>
        </View>

        <View style={s.qaGrid}>
          {actions.map((a) => (
            <TouchableOpacity key={a.id} style={s.qaBtn} onPress={() => a.nav(navigation)} activeOpacity={0.75}>
              <View style={[s.qaIconCircle, { backgroundColor: a.color + "18" }]}>
                <Ionicons name={a.icon} size={20} color={a.color} />
              </View>
              <Text style={s.qaLabel} numberOfLines={2}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {editMode && (
          <TouchableOpacity style={s.customiseRow} onPress={onCustomizePress} activeOpacity={0.75}>
            <Ionicons name="options-outline" size={14} color={colors.primary} />
            <Text style={s.customiseText}>Customise actions ({activeActions.length}/{MAX_ACTIONS})</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </TourTarget>
  );
}

// ─── Widget: Action Picker (inline panel below QuickActions in edit mode) ─────
function ActionPickerPanel({ activeActions, setActiveActions, s, colors }) {
  const atMax = activeActions.length >= MAX_ACTIONS;
  return (
    <View style={s.addPanel}>
      <View style={s.addPanelHeaderRow}>
        <Text style={s.addPanelHeading}>Customise Actions</Text>
        <Text style={[s.addPanelCount, atMax && { color: "#f97316" }]}>
          {activeActions.length}/{MAX_ACTIONS}
        </Text>
      </View>
      {ALL_ACTIONS.map((a, i) => {
        const isOn = activeActions.includes(a.id);
        return (
          <View
            key={a.id}
            style={[
              s.addPanelRow,
              i < ALL_ACTIONS.length - 1 && s.addPanelRowBorder,
              isOn && { backgroundColor: a.color + "08" },
            ]}
          >
            <View style={[s.addPanelIcon, { backgroundColor: a.color + "18" }]}>
              <Ionicons name={a.icon} size={18} color={a.color} />
            </View>
            <Text style={[s.addPanelName, { flex: 1 }]}>{a.label}</Text>
            {isOn ? (
              <TouchableOpacity
                style={[s.editBtn, { backgroundColor: "#dcfce7", borderColor: "#86efac" }]}
                onPress={() => setActiveActions((prev) => prev.filter((id) => id !== a.id))}
              >
                <Ionicons name="checkmark" size={14} color="#16a34a" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.addPanelPlusBtn, atMax && { opacity: 0.3 }]}
                onPress={() => { if (!atMax) setActiveActions((prev) => [...prev, a.id]); }}
                disabled={atMax}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Widget: Calories Burned (HealthKit) ──────────────────────────────────────
function CaloriesBurnedWidget({ todayCalsBurned, navigation, s, colors }) {
  return (
    <TouchableOpacity
      style={s.widgetCard}
      onPress={() => xNav(navigation, "Tracking", "ActivityTracking")}
      activeOpacity={0.85}
    >
      <View style={[s.widgetHeader, { justifyContent: "space-between" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={[s.widgetIconWrap, { backgroundColor: "#ef444415" }]}>
            <Ionicons name="flame-outline" size={17} color="#ef4444" />
          </View>
          <Text style={s.widgetTitle}>Calories Burned</Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={colors.textLight} />
      </View>

      {todayCalsBurned !== null ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
            <Text style={[s.bigNum, { color: "#ef4444" }]}>
              {todayCalsBurned.toLocaleString()}
            </Text>
            <Text style={s.bigNumUnit}>kcal active today</Text>
          </View>
          <View style={s.calsBurnedBar}>
            <View style={[s.calsBurnedFill, {
              width: `${Math.min(100, (todayCalsBurned / 600) * 100)}%`,
            }]} />
          </View>
          <Text style={s.widgetCaption}>Based on Apple Watch activity</Text>
        </>
      ) : (
        <View style={s.unavailBox}>
          <Ionicons name="watch-outline" size={26} color={colors.textLight} />
          <Text style={s.unavailText}>Sync an Apple Watch to see calories burned</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Widget: Steps (HealthKit) ────────────────────────────────────────────────
function StepsWidget({ todaySteps, navigation, s, colors }) {
  const pct = Math.min(100, ((todaySteps || 0) / STEP_GOAL) * 100);
  return (
    <TouchableOpacity
      style={s.widgetCard}
      onPress={() => xNav(navigation, "Tracking", "ActivityTracking")}
      activeOpacity={0.85}
    >
      <View style={[s.widgetHeader, { justifyContent: "space-between" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={[s.widgetIconWrap, { backgroundColor: "#22c55e15" }]}>
            <Ionicons name="footsteps-outline" size={17} color="#22c55e" />
          </View>
          <Text style={s.widgetTitle}>Steps Today</Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={colors.textLight} />
      </View>

      {todaySteps !== null ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
            <Text style={[s.bigNum, { color: "#22c55e" }]}>{todaySteps.toLocaleString()}</Text>
            <Text style={s.bigNumUnit}>/ {STEP_GOAL.toLocaleString()}</Text>
          </View>
          <View style={s.stepsBarBg}>
            <View style={[s.stepsBarFill, { width: `${pct}%` }]} />
          </View>
          <Text style={s.widgetCaption}>{Math.round(pct)}% of daily goal</Text>
        </>
      ) : (
        <View style={s.unavailBox}>
          <Ionicons name="watch-outline" size={26} color={colors.textLight} />
          <Text style={s.unavailText}>Sync an Apple Watch to see your steps</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Widget: Water Tracker (API-backed, matching FoodScreen ring design) ───────
function WaterWidget({ waterMl, onLogWater, waterSaving, s, colors }) {
  const pct    = Math.min(1, waterMl / WATER_GOAL_ML);
  const offset = WR_CIRC * (1 - pct);

  return (
    <View style={s.widgetCard}>
      <View style={s.widgetHeader}>
        <View style={[s.widgetIconWrap, { backgroundColor: "#0ea5e915" }]}>
          <Ionicons name="water-outline" size={17} color="#0ea5e9" />
        </View>
        <Text style={s.widgetTitle}>Water Intake</Text>
      </View>

      <View style={s.waterRow}>
        {/* SVG ring with drop icon + % overlay (no text numbers — matches food section style) */}
        <View style={s.waterRingWrap}>
          <Svg width={WR_SIZE} height={WR_SIZE} style={{ position: "absolute" }}>
            <Circle cx={WR_SIZE/2} cy={WR_SIZE/2} r={WR_R}
              stroke={colors.border} strokeWidth={WR_SW} fill="none" />
            <Circle cx={WR_SIZE/2} cy={WR_SIZE/2} r={WR_R}
              stroke="#0ea5e9" strokeWidth={WR_SW} fill="none"
              strokeDasharray={`${WR_CIRC}`} strokeDashoffset={offset}
              strokeLinecap="round" rotation="-90"
              origin={`${WR_SIZE/2},${WR_SIZE/2}`} />
          </Svg>
          {/* Drop icon + percent centred over ring */}
          <Ionicons name="water" size={24} color="#0ea5e9" />
          <Text style={s.waterRingPct}>{Math.round(pct * 100)}%</Text>
        </View>

        {/* Quick-add preset grid (2×2) */}
        <View style={s.waterPresetsGrid}>
          {WATER_PRESETS.map(({ label, ml }) => (
            <TouchableOpacity
              key={label}
              style={[s.waterPresetBtn, waterSaving && { opacity: 0.5 }]}
              onPress={() => onLogWater(ml)}
              disabled={waterSaving}
              activeOpacity={0.7}
            >
              <Text style={s.waterPresetLabel}>{label}</Text>
              <Text style={s.waterPresetMl}>+{ml} ml</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Widget: Activity Stats ────────────────────────────────────────────────────
function ActivityStatsWidget({ workoutTotalMins, workoutsWeek, s }) {
  const hours = (workoutTotalMins / 60).toFixed(1);
  return (
    <View style={s.widgetCard}>
      <View style={s.widgetHeader}>
        <View style={[s.widgetIconWrap, { backgroundColor: "#f9731615" }]}>
          <Ionicons name="analytics-outline" size={17} color="#f97316" />
        </View>
        <Text style={s.widgetTitle}>Activity Stats</Text>
      </View>
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={[s.statBigNum, { color: "#f97316" }]}>{hours}h</Text>
          <Text style={s.statLbl}>workout time this week</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={[s.statBigNum, { color: "#22c55e" }]}>{workoutsWeek}</Text>
          <Text style={s.statLbl}>workouts this week</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Weekly Insight helpers ───────────────────────────────────────────────────
const INSIGHT_LINE_STYLES = {
  "✅": { bg: "#22c55e14", border: "#22c55e40", emoji: "✅" },
  "⚠️": { bg: "#f59e0b14", border: "#f59e0b40", emoji: "⚠️" },
  "💡": { bg: "#8b5cf614", border: "#8b5cf640", emoji: "💡" },
  "📊": { bg: "#0ea5e914", border: "#0ea5e940", emoji: "📊" },
};

function getLineStyle(line) {
  for (const [emoji, style] of Object.entries(INSIGHT_LINE_STYLES)) {
    if (line.startsWith(emoji)) return style;
  }
  return { bg: "transparent", border: "transparent", emoji: null };
}

// ─── Widget: Weekly Insight ───────────────────────────────────────────────────
function WeeklyInsightWidget({ insight, insightLoading, s, colors }) {
  // Split on blank lines → each section = { header, body }
  const sections = insight
    ? insight
        .split(/\n\n+/)
        .map((block) => {
          const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
          return { header: lines[0] || "", body: lines.slice(1).join(" ").trim() };
        })
        .filter((sec) => sec.header)
    : [];

  return (
    <TourTarget tourKey="dash_insight">
      <View style={s.insightCard}>
        <View style={s.widgetHeader}>
          <View style={[s.widgetIconWrap, { backgroundColor: "#8b5cf615" }]}>
            <Ionicons name="sparkles-outline" size={17} color="#8b5cf6" />
          </View>
          <Text style={s.widgetTitle}>Weekly Insight</Text>
        </View>

        {insightLoading ? (
          <View style={{ gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={[s.insightLine, { backgroundColor: colors.border, borderColor: "transparent", opacity: 0.4 }]}>
                <Text style={[s.insightLineHeader, { color: "transparent" }]}>Loading</Text>
                <Text style={[s.insightLineBody,   { color: "transparent" }]}>Loading detail text here</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {sections.map(({ header, body }, i) => {
              const ls = getLineStyle(header);
              return (
                <View
                  key={i}
                  style={[s.insightLine, { backgroundColor: ls.bg, borderColor: ls.border }]}
                >
                  <Text style={s.insightLineHeader}>{header}</Text>
                  {body ? <Text style={s.insightLineBody}>{body}</Text> : null}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </TourTarget>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const { colors } = useTheme();
  const { auth }   = useAuth();
  const { startTour, registerScroll } = useTour();
  const insets     = useSafeAreaInsets();
  const scrollRef  = useRef(null);
  const userId     = auth?.userId;

  // ── Core API data ──────────────────────────────────────────────────────────
  const [dashboard, setDashboard]           = useState(null);
  const [loading, setLoading]               = useState(true);
  const [insight, setInsight]               = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);

  // ── Water ──────────────────────────────────────────────────────────────────
  const [waterMl, setWaterMl]         = useState(0);
  const [waterSaving, setWaterSaving] = useState(false);

  // ── Workout stats ──────────────────────────────────────────────────────────
  const [workoutTotalMins, setWorkoutTotalMins] = useState(0);

  // ── HealthKit ──────────────────────────────────────────────────────────────
  const [todaySteps, setTodaySteps]           = useState(null);
  const [todayCalsBurned, setTodayCalsBurned] = useState(null);

  // ── Widget layout ──────────────────────────────────────────────────────────
  const [widgetLayout, setWidgetLayout] = useState(DEFAULT_LAYOUT);
  const [editMode, setEditMode]         = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showActionPicker, setShowActionPicker] = useState(false);

  // ── Quick actions ──────────────────────────────────────────────────────────
  const [activeActions, setActiveActions] = useState(DEFAULT_ACTIONS);

  // ── Goal editing ───────────────────────────────────────────────────────────
  const [goalEditOpen, setGoalEditOpen] = useState(false);
  const [goalDraft, setGoalDraft]       = useState({ protein: "", carbs: "", fat: "" });
  const [goalSaving, setGoalSaving]     = useState(false);
  const [goalErr, setGoalErr]           = useState("");

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => { registerScroll("Dashboard", scrollRef); }, []);
  useEffect(() => {
    const t = setTimeout(() => startTour(), 800);
    return () => clearTimeout(t);
  }, []);

  // ── Persist / restore widget layout ───────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(layoutKey(userId))
      .then((raw) => { if (raw) setWidgetLayout(JSON.parse(raw)); })
      .catch(() => {});
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    AsyncStorage.setItem(layoutKey(userId), JSON.stringify(widgetLayout)).catch(() => {});
  }, [widgetLayout, userId]);

  // ── Persist / restore quick actions ───────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(actionsKey(userId))
      .then((raw) => { if (raw) setActiveActions(JSON.parse(raw)); })
      .catch(() => {});
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    AsyncStorage.setItem(actionsKey(userId), JSON.stringify(activeActions)).catch(() => {});
  }, [activeActions, userId]);

  // ── Main data load (polled every 30 s) ────────────────────────────────────
  const load = useCallback(async () => {
    if (!userId) return;
    let cancelled = false;
    try {
      setLoading(true);
      const [dashRes, waterRes, workoutRes] = await Promise.all([
        apiClient.get(`/api/dashboard-summary/user/${userId}`,
          { params: { timezone: "Europe/London" } }),
        apiClient.get(`/api/water-entries/user/${userId}/today`)
          .catch(() => ({ data: { totalMl: 0 } })),
        apiClient.get(`/api/workout-logs/user/${userId}`)
          .catch(() => ({ data: [] })),
      ]);
      if (!cancelled) {
        setDashboard(dashRes.data);
        setWaterMl(toN(waterRes.data?.totalMl));
        const logs = Array.isArray(workoutRes.data) ? workoutRes.data : [];
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const weeklyMins = logs
          .filter((w) => { const d = new Date(w.performedAt || w.completedAt); return !isNaN(d.getTime()) && d >= weekAgo; })
          .reduce((s, w) => s + toN(w.durationMinutes), 0);
        setWorkoutTotalMins(weeklyMins);
      }
    } catch {
      if (!cancelled) setDashboard(null);
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 30000);
    return () => clearInterval(poll);
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Notifications trigger ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const workoutDays = dashboard?.selectedPlan?.daysPerWeek
      ? [1,2,3,4,5,6,0].slice(0, dashboard.selectedPlan.daysPerWeek) : [];
    checkFoodReminder(userId);
    checkStreakReminder(userId);
    checkWorkoutReminder(userId, workoutDays);
  }, [userId, dashboard?.selectedPlan?.daysPerWeek]);

  // ── Weekly insight ─────────────────────────────────────────────────────────
  const INSIGHT_FALLBACK =
    "✅ Consistency is your biggest asset\n" +
    "Every session and meal logged moves you forward.\n\n" +
    "⚠️ Daily food logging needs attention\n" +
    "Tracking every day gives you accurate data to act on.\n\n" +
    "💡 Plan tomorrow's meals tonight\n" +
    "Five minutes of planning prevents poor choices tomorrow.";

  useEffect(() => {
    if (!userId) return;
    setInsightLoading(true);
    apiClient.get(`/api/ai/weekly-insight/${userId}`)
      .then((res) => {
        const text = res.data?.insight;
        setInsight(text && text.trim() ? text.trim() : INSIGHT_FALLBACK);
      })
      .catch(() => setInsight(INSIGHT_FALLBACK))
      .finally(() => setInsightLoading(false));
  }, [userId]);

  // ── HealthKit ──────────────────────────────────────────────────────────────
  const loadHK = useCallback(async () => {
    if (!HK_AVAILABLE) return;
    const [steps, cals] = await Promise.all([getTodaySteps(), getTodayCalories()]);
    setTodaySteps(steps);
    setTodayCalsBurned(cals);
  }, []);
  useEffect(() => { loadHK(); }, [loadHK]);
  useFocusEffect(useCallback(() => { loadHK(); }, [loadHK]));

  // ── Save macro goals ───────────────────────────────────────────────────────
  async function saveGoals() {
    const protein = toN(goalDraft.protein);
    const carbs   = toN(goalDraft.carbs);
    const fat     = toN(goalDraft.fat);
    if (!protein || !carbs || !fat) { setGoalErr("All three fields are required."); return; }
    if (protein < 10 || protein > 600 || carbs < 10 || carbs > 800 || fat < 5 || fat > 400) {
      setGoalErr("Please enter realistic values."); return;
    }
    const calorieGoal = Math.round(protein * 4 + carbs * 4 + fat * 9);
    setGoalSaving(true); setGoalErr("");
    try {
      await apiClient.put(`/api/user-goals/user/${userId}`, {
        userId, calorieGoal, proteinGoal: protein, carbGoal: carbs, fatGoal: fat,
      });
      setGoalEditOpen(false);
      load();
    } catch {
      setGoalErr("Could not save. Try again.");
    } finally {
      setGoalSaving(false);
    }
  }

  // ── Log water ──────────────────────────────────────────────────────────────
  const logWater = useCallback(async (ml) => {
    if (!userId || waterSaving) return;
    setWaterSaving(true);
    setWaterMl((prev) => prev + ml); // optimistic
    try {
      await apiClient.post("/api/water-entries", {
        userId, waterMl: ml, loggedAt: new Date().toISOString(),
      });
    } catch {
      setWaterMl((prev) => prev - ml); // rollback on error
    } finally {
      setWaterSaving(false);
    }
  }, [userId, waterSaving]);

  // ── Derived view ───────────────────────────────────────────────────────────
  const view = useMemo(() => {
    const d = dashboard ?? {};
    const caloriesGoal  = Math.max(0, toN(d.caloriesGoal));
    const caloriesTotal = Math.max(0, toN(d.totalCalories));
    const remaining     = Math.max(0, caloriesGoal - caloriesTotal);
    const overBy        = Math.max(0, caloriesTotal - caloriesGoal);
    return {
      caloriesGoal, caloriesTotal, remaining, overBy,
      isOver: overBy > 0,
      caloriesPercent: caloriesGoal ? clamp((caloriesTotal / caloriesGoal) * 100, 0, 100) : 0,
      proteinTotal: toN(d.totalProteins), proteinGoal: toN(d.proteinsGoal),
      carbsTotal:   toN(d.totalCarbs),   carbsGoal:   toN(d.carbsGoal),
      fatTotal:     toN(d.totalFats),    fatGoal:     toN(d.fatsGoal),
      streak:       Math.max(0, toN(d.currentStreakDays)),
      workoutsWeek: Math.max(0, toN(d.workoutsLast7Days)),
    };
  }, [dashboard]);

  // ── Layout helpers ─────────────────────────────────────────────────────────
  const moveWidget = (idx, dir) => {
    setWidgetLayout((prev) => {
      const next = [...prev]; const t = idx + dir;
      if (t < 0 || t >= next.length) return prev;
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  };
  const removeWidget = (id) => setWidgetLayout((p) => p.filter((w) => w !== id));
  const addWidget    = (id) => setWidgetLayout((p) => [...p, id]);

  const availableToAdd = useMemo(
    () => ALL_WIDGETS.filter((w) => !widgetLayout.includes(w.id)),
    [widgetLayout],
  );

  // ── Styles ─────────────────────────────────────────────────────────────────
  const s = useMemo(() => makeStyles(colors), [colors]);

  // ── Widget renderer ────────────────────────────────────────────────────────
  function renderWidget(id) {
    switch (id) {
      case "quickActions":
        return (
          <QuickActionsWidget
            navigation={navigation}
            activeActions={activeActions}
            editMode={editMode}
            onCustomizePress={() => setShowActionPicker((v) => !v)}
            s={s} colors={colors}
          />
        );
      case "caloriesBurned":
        return <CaloriesBurnedWidget todayCalsBurned={todayCalsBurned} navigation={navigation} s={s} colors={colors} />;
      case "steps":
        return <StepsWidget todaySteps={todaySteps} navigation={navigation} s={s} colors={colors} />;
      case "water":
        return <WaterWidget waterMl={waterMl} onLogWater={logWater} waterSaving={waterSaving} s={s} colors={colors} />;
      case "activityStats":
        return <ActivityStatsWidget workoutTotalMins={workoutTotalMins} workoutsWeek={view.workoutsWeek} s={s} />;
      case "weeklyInsight":
        return <WeeklyInsightWidget insight={insight} insightLoading={insightLoading} s={s} colors={colors} />;
      default:
        return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.screen} edges={[]}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={s.headerLeft}>
          <TourTarget tourKey="dash_profile">
            <ProfileButton onPress={() => navigation.navigate("Profile")} />
          </TourTarget>
          <TouchableOpacity
            style={[s.chatHeaderBtn, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "35" }]}
            onPress={() => xNav(navigation, "Chat")}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-ellipses" size={17} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <Text style={s.headerTitle}>Dashboard</Text>
        <View style={s.headerRight}>
          {editMode ? (
            <TouchableOpacity
              onPress={() => { setEditMode(false); setShowAddPanel(false); setShowActionPicker(false); }}
              style={s.doneBtn}
            >
              <Text style={s.doneBtnText}>Done</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <TourTarget tourKey="dash_editor">
                <TouchableOpacity
                  onPress={() => setEditMode(true)}
                  style={{ width: 36, alignItems: "center" }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="grid-outline" size={22} color={colors.text} />
                </TouchableOpacity>
              </TourTarget>
              <TourTarget tourKey="dash_notifications">
                <NotificationBell onPress={() => navigation.navigate("Notifications")} />
              </TourTarget>
            </View>
          )}
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        {/* ── Greeting + streak badge ───────────────────────────────────── */}
        <View style={s.greetRow}>
          <View>
            <Text style={s.greetText}>{greeting()} 👋</Text>
            <Text style={s.greetSub}>Here's your overview for today</Text>
          </View>
          <View style={s.streakBadge}>
            <Text style={s.streakFire}>🔥</Text>
            <Text style={s.streakBadgeNum}>{loading ? "–" : view.streak}</Text>
            <Text style={s.streakBadgeLbl}>streak</Text>
          </View>
        </View>

        {/* ── Pinned: Calorie / Macro card ──────────────────────────────── */}
        <TourTarget tourKey="dash_overview">
          <View style={s.macroCard}>
            <View style={s.macroLeft}>
              {[
                { label: "Protein", cur: view.proteinTotal, goal: view.proteinGoal, color: colors.protein },
                { label: "Carbs",   cur: view.carbsTotal,   goal: view.carbsGoal,   color: colors.carbs   },
                { label: "Fat",     cur: view.fatTotal,     goal: view.fatGoal,     color: colors.fat     },
              ].map((m) => (
                <View key={m.label} style={s.macroRow}>
                  <MiniRing current={m.cur} goal={m.goal} color={m.color} />
                  <View style={s.macroTextWrap}>
                    <Text style={s.macroName}>{m.label}</Text>
                    <Text style={s.macroVals}>
                      {fmt(Math.min(m.cur, m.goal))}g
                      <Text style={s.macroGoalTxt}> / {fmt(m.goal)}g</Text>
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={s.macroDivider} />
            <View style={s.calRight}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={s.calLabel}>Calorie Goal</Text>
                <TouchableOpacity
                  onPress={() => {
                    setGoalDraft({
                      protein: String(Math.round(view.proteinGoal || 150)),
                      carbs:   String(Math.round(view.carbsGoal   || 200)),
                      fat:     String(Math.round(view.fatGoal     || 65)),
                    });
                    setGoalErr("");
                    setGoalEditOpen(true);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="create-outline" size={13} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={s.calValue}>{loading ? "–" : fmt(view.caloriesGoal)}</Text>
              <Text style={s.calUnit}>kcal</Text>
              <DonutChart percent={view.caloriesPercent} />
              <View style={[s.calChip, view.isOver && s.calChipOver]}>
                <Text style={[s.calChipText, view.isOver && { color: "#b91c1c" }]}>
                  {view.isOver ? `+${fmt(view.overBy)} over` : `${fmt(view.remaining)} left`}
                </Text>
              </View>
            </View>
          </View>
        </TourTarget>

        {/* ── Widget list ───────────────────────────────────────────────── */}
        {widgetLayout.map((id, idx) => {
          const def = ALL_WIDGETS.find((w) => w.id === id);
          if (!def) return null;
          return (
            <View key={id}>
              {/* Edit bar */}
              {editMode && (
                <View style={s.editBar}>
                  <View style={s.editBarLeft}>
                    <Ionicons name="menu-outline" size={15} color={colors.textSecondary} />
                    <Text style={s.editBarTitle}>{def.title}</Text>
                  </View>
                  <View style={s.editBarRight}>
                    <TouchableOpacity
                      style={[s.editBtn, idx === 0 && s.editBtnOff]}
                      onPress={() => moveWidget(idx, -1)} disabled={idx === 0}
                    >
                      <Ionicons name="chevron-up" size={15}
                        color={idx === 0 ? colors.textLight : colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.editBtn, idx === widgetLayout.length - 1 && s.editBtnOff]}
                      onPress={() => moveWidget(idx, 1)} disabled={idx === widgetLayout.length - 1}
                    >
                      <Ionicons name="chevron-down" size={15}
                        color={idx === widgetLayout.length - 1 ? colors.textLight : colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.editBtn, s.editBtnRemove]}
                      onPress={() => {
                        removeWidget(id);
                        if (id === "quickActions") setShowActionPicker(false);
                      }}
                    >
                      <Ionicons name="close" size={15} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {renderWidget(id)}
              {/* Inline action picker — shown below quickActions widget */}
              {editMode && id === "quickActions" && showActionPicker && (
                <ActionPickerPanel
                  activeActions={activeActions}
                  setActiveActions={setActiveActions}
                  s={s} colors={colors}
                />
              )}
            </View>
          );
        })}

        {/* ── Edit mode: Add Widget ──────────────────────────────────────── */}
        {editMode && (
          <>
            <TouchableOpacity
              style={s.addWidgetRow}
              onPress={() => setShowAddPanel((v) => !v)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={showAddPanel ? "chevron-up-circle-outline" : "add-circle-outline"}
                size={20} color={colors.primary}
              />
              <Text style={s.addWidgetText}>
                {showAddPanel ? "Hide available widgets" : "Add a widget"}
              </Text>
            </TouchableOpacity>

            {showAddPanel && (
              <View style={s.addPanel}>
                <Text style={s.addPanelHeading}>Available Widgets</Text>
                {availableToAdd.length === 0 ? (
                  <Text style={s.addPanelEmpty}>All widgets are already on your dashboard.</Text>
                ) : (
                  availableToAdd.map((w, i) => {
                    const locked = w.requiresHK && !HK_AVAILABLE;
                    return (
                      <View
                        key={w.id}
                        style={[
                          s.addPanelRow,
                          i < availableToAdd.length - 1 && s.addPanelRowBorder,
                          locked && { opacity: 0.4 },
                        ]}
                      >
                        <View style={[s.addPanelIcon, { backgroundColor: w.color + "18" }]}>
                          <Ionicons name={w.icon} size={20} color={locked ? colors.textLight : w.color} />
                        </View>
                        <View style={s.addPanelMeta}>
                          <Text style={s.addPanelName}>{w.title}</Text>
                          <Text style={s.addPanelDesc}>{locked ? "Requires Apple Watch" : w.desc}</Text>
                        </View>
                        {locked
                          ? <Ionicons name="lock-closed-outline" size={16} color={colors.textLight} />
                          : (
                            <TouchableOpacity
                              style={s.addPanelPlusBtn}
                              onPress={() => {
                                addWidget(w.id);
                                if (availableToAdd.length === 1) setShowAddPanel(false);
                              }}
                            >
                              <Ionicons name="add" size={18} color={colors.primary} />
                            </TouchableOpacity>
                          )
                        }
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </>
        )}

        {loading && <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* ── Macro / Calorie Goal Edit Modal ──────────────────────────────── */}
      <Modal visible={goalEditOpen} transparent animationType="fade" onRequestClose={() => setGoalEditOpen(false)}>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Edit Daily Goals</Text>

            {/* Calorie preview block */}
            {(() => {
              const p = toN(goalDraft.protein), c = toN(goalDraft.carbs), f = toN(goalDraft.fat);
              const cal = p && c && f ? Math.round(p * 4 + c * 4 + f * 9) : null;
              const col = colors.primary || "#0b84ff";
              return (
                <View style={s.calPreviewBlock}>
                  <Text style={s.calPreviewLabel}>DAILY CALORIE GOAL</Text>
                  <Text style={[s.calPreviewNum, { color: cal ? col : colors.textLight }]}>{cal ?? "—"}</Text>
                  <Text style={s.calPreviewUnit}>kcal / day</Text>
                </View>
              );
            })()}

            {/* Colour-coded macro inputs */}
            {[
              { field: "protein", label: "Protein", color: colors.protein || "#6366f1", ph: "e.g. 150" },
              { field: "carbs",   label: "Carbs",   color: colors.carbs   || "#f59e0b", ph: "e.g. 200" },
              { field: "fat",     label: "Fat",     color: colors.fat     || "#22c55e", ph: "e.g. 65"  },
            ].map(({ field, label, color, ph }) => (
              <View key={field} style={{ gap: 5 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                  <Text style={[s.modalFieldLabel, { color, marginBottom: 0 }]}>{label} (g)</Text>
                </View>
                <TextInput
                  style={[s.modalInput, { borderColor: color + "88" }]}
                  keyboardType="decimal-pad"
                  placeholder={ph}
                  placeholderTextColor={colors.textLight}
                  value={goalDraft[field]}
                  onChangeText={(v) => setGoalDraft((prev) => ({ ...prev, [field]: v }))}
                />
              </View>
            ))}
            {goalErr ? <Text style={s.modalErrText}>{goalErr}</Text> : null}
            <TouchableOpacity
              style={[s.modalSaveBtn, goalSaving && { opacity: 0.6 }]}
              onPress={saveGoals}
              disabled={goalSaving}
            >
              {goalSaving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.modalSaveBtnText}>Save Goals</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={s.modalCancelBtn} onPress={() => setGoalEditOpen(false)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(colors) {
  const shadow = {
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  };
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },

    // Header
    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerLeft:  { minWidth: 84, flexDirection: "row", alignItems: "center", gap: 8 },
    chatHeaderBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    headerRight: { minWidth: 72, alignItems: "flex-end" },
    doneBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
    doneBtnText: { fontSize: font.base, fontWeight: font.bold, color: colors.primary },

    // Body
    body: { padding: spacing.lg, gap: spacing.md },

    // Greeting
    greetRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: spacing.xs,
    },
    greetText: { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    greetSub:  { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
    streakBadge: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: colors.streakBg, borderRadius: radius.full,
      paddingHorizontal: spacing.md, paddingVertical: 7,
    },
    streakFire:     { fontSize: 15 },
    streakBadgeNum: { fontSize: font.base, fontWeight: font.bold, color: colors.streak },
    streakBadgeLbl: { fontSize: 11, fontWeight: "600", color: colors.streak, opacity: 0.8 },

    // Pinned macro / calorie card
    macroCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg,
      padding: spacing.lg, flexDirection: "row", gap: spacing.md, ...shadow,
    },
    macroLeft:    { flex: 1, gap: spacing.md, justifyContent: "center" },
    macroRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
    macroTextWrap:{ flex: 1 },
    macroName:    { fontSize: font.sm, fontWeight: "600", color: colors.textSecondary },
    macroVals:    { fontSize: font.sm, fontWeight: font.bold, color: colors.text, marginTop: 1 },
    macroGoalTxt: { fontWeight: "400", color: colors.textSecondary },
    macroDivider: { width: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
    calRight:     { flex: 1, alignItems: "center", gap: 3, justifyContent: "center" },
    calLabel:     { fontSize: font.sm, color: colors.textSecondary },
    calValue:     { fontSize: 24, fontWeight: "900", color: colors.text, lineHeight: 28 },
    calUnit:      { fontSize: font.sm, color: colors.textSecondary, marginTop: -2 },
    calChip: {
      backgroundColor: colors.background, borderRadius: radius.full,
      paddingHorizontal: spacing.md, paddingVertical: 4, marginTop: 2,
    },
    calChipOver: { backgroundColor: "#fee2e2" },
    calChipText: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },

    // Edit bar
    editBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: colors.background,
      borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: spacing.md, paddingVertical: 7, marginBottom: 4,
    },
    editBarLeft:  { flexDirection: "row", alignItems: "center", gap: 6 },
    editBarTitle: { fontSize: font.sm, fontWeight: "600", color: colors.textSecondary },
    editBarRight: { flexDirection: "row", alignItems: "center", gap: 5 },
    editBtn: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      alignItems: "center", justifyContent: "center",
    },
    editBtnOff:    { opacity: 0.3 },
    editBtnRemove: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },

    // Add widget row & panel
    addWidgetRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, paddingVertical: spacing.md,
      borderRadius: radius.lg, borderWidth: 1.5,
      borderColor: colors.primary, borderStyle: "dashed",
    },
    addWidgetText: { fontSize: font.base, fontWeight: "600", color: colors.primary },
    addPanel: {
      backgroundColor: colors.surface, borderRadius: radius.lg,
      padding: spacing.lg, gap: spacing.sm, ...shadow,
    },
    addPanelHeaderRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      marginBottom: 4,
    },
    addPanelHeading: { fontSize: font.base, fontWeight: font.bold, color: colors.text },
    addPanelCount:   { fontSize: font.sm, color: colors.textSecondary, fontWeight: "600" },
    addPanelEmpty:   { fontSize: font.sm, color: colors.textSecondary, textAlign: "center", paddingVertical: spacing.sm },
    addPanelRow:     { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
    addPanelRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    addPanelIcon:    { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    addPanelMeta:    { flex: 1 },
    addPanelName:    { fontSize: font.sm, fontWeight: "600", color: colors.text },
    addPanelDesc:    { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    addPanelPlusBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: colors.insightBg,
      borderWidth: 1.5, borderColor: colors.primary,
      alignItems: "center", justifyContent: "center",
    },

    // Shared widget card
    widgetCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg,
      padding: spacing.lg, gap: spacing.md, ...shadow,
    },
    widgetHeader:  { flexDirection: "row", alignItems: "center", gap: 10 },
    widgetIconWrap:{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    widgetTitle:   { fontSize: font.base, fontWeight: font.bold, color: colors.text },
    widgetCaption: { fontSize: 11, color: colors.textSecondary },
    unavailBox:    { alignItems: "center", gap: 6, paddingVertical: spacing.sm },
    unavailText:   { fontSize: font.sm, color: colors.textSecondary, textAlign: "center" },

    // Quick Actions
    qaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    qaBtn: {
      width: "30%", flexGrow: 1, alignItems: "center", gap: 7,
      backgroundColor: colors.background,
      borderRadius: radius.lg, paddingVertical: spacing.md,
      borderWidth: 1, borderColor: colors.border,
    },
    qaIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    qaLabel:      { fontSize: 10, fontWeight: "600", color: colors.text, textAlign: "center" },
    customiseRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, paddingTop: spacing.sm,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    customiseText: { fontSize: font.sm, fontWeight: "600", color: colors.primary },

    // Big number (steps, calories burned)
    bigNum:     { fontSize: 34, fontWeight: "900", color: colors.text },
    bigNumUnit: { fontSize: font.sm, color: colors.textSecondary },

    // Steps bar
    stepsBarBg:   { height: 8, backgroundColor: colors.border, borderRadius: radius.full, overflow: "hidden" },
    stepsBarFill: { height: "100%", backgroundColor: "#22c55e", borderRadius: radius.full },

    // Calories burned bar
    calsBurnedBar:  { height: 8, backgroundColor: colors.border, borderRadius: radius.full, overflow: "hidden" },
    calsBurnedFill: { height: "100%", backgroundColor: "#ef4444", borderRadius: radius.full },

    // Water widget
    waterRow:       { flexDirection: "row", alignItems: "center", gap: spacing.lg },
    waterRingWrap:  {
      width: WR_SIZE, height: WR_SIZE,
      alignItems: "center", justifyContent: "center",
    },
    waterRingPct:   { fontSize: 13, fontWeight: font.bold, color: "#0ea5e9", marginTop: 2 },
    waterPresetsGrid: {
      flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6,
    },
    waterPresetBtn: {
      width: "47%", flexGrow: 1,
      alignItems: "center", paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: "#0ea5e918",
      borderWidth: 1, borderColor: "#0ea5e930",
    },
    waterPresetLabel: { fontSize: 11, fontWeight: "700", color: "#0ea5e9" },
    waterPresetMl:    { fontSize: 10, color: colors.textSecondary, marginTop: 1 },

    // Activity Stats
    statsRow:    {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.background, borderRadius: radius.md,
      paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    },
    statBox:     { flex: 1, alignItems: "center", gap: 3 },
    statBigNum:  { fontSize: 28, fontWeight: "900" },
    statLbl:     { fontSize: 11, color: colors.textSecondary, fontWeight: "600", textAlign: "center" },
    statDivider: { width: 1, height: 40, backgroundColor: colors.border, marginHorizontal: spacing.md },

    // Goal edit modal
    modalOverlay: {
      flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center", alignItems: "center",
    },
    modalSheet: {
      backgroundColor: colors.surface, borderRadius: 20,
      padding: spacing.xl, width: "88%", gap: spacing.md,
    },
    modalTitle: { fontSize: font.xl, fontWeight: font.bold, color: colors.text, textAlign: "center" },
    modalSub:   { fontSize: font.sm, color: colors.textSecondary, textAlign: "center" },
    modalFieldLabel: { fontSize: font.sm, fontWeight: "600", color: colors.textSecondary, marginBottom: 4 },
    modalInput: {
      backgroundColor: colors.background, borderRadius: radius.md,
      paddingHorizontal: spacing.lg, paddingVertical: 12,
      fontSize: font.base, color: colors.text, textAlign: "center",
      borderWidth: 1.5, borderColor: colors.border, marginBottom: 4,
    },
    modalErrText: { color: colors.error, fontSize: font.sm, textAlign: "center" },
    calPreviewBlock: {
      backgroundColor: (colors.primary || "#0b84ff") + "12",
      borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: spacing.lg,
      alignItems: "center", gap: 2,
      borderWidth: 1, borderColor: (colors.primary || "#0b84ff") + "30",
    },
    calPreviewLabel: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, letterSpacing: 1 },
    calPreviewNum:   { fontSize: 44, fontWeight: "900", lineHeight: 50 },
    calPreviewUnit:  { fontSize: font.sm, fontWeight: "600", color: colors.textSecondary },
    modalSaveBtn: {
      backgroundColor: colors.primary, borderRadius: radius.lg,
      paddingVertical: 14, alignItems: "center", justifyContent: "center",
    },
    modalSaveBtnText: { color: "#fff", fontSize: font.base, fontWeight: font.bold },
    modalCancelBtn: { alignItems: "center", paddingVertical: 8 },
    modalCancelText: { fontSize: font.base, color: colors.textSecondary },

    // Weekly Insight
    insightCard: {
      backgroundColor: colors.insightBg, borderRadius: radius.lg,
      padding: spacing.lg, gap: spacing.md,
      borderWidth: 1, borderColor: colors.insightBorder,
    },
    aiBadge:      { backgroundColor: colors.primary + "18", borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
    aiBadgeText:  { fontSize: 10, fontWeight: font.bold, color: colors.primary },
    insightLine: {
      borderRadius: radius.md, borderWidth: 1,
      paddingVertical: 11, paddingHorizontal: 13, gap: 4,
    },
    insightLineHeader: { fontSize: font.sm, color: colors.text, fontWeight: "700", lineHeight: 19 },
    insightLineBody:   { fontSize: font.sm - 1, color: colors.textSecondary, lineHeight: 18 },
    insightEmpty: { fontSize: font.sm, color: colors.textSecondary, fontStyle: "italic" },
  });
}
