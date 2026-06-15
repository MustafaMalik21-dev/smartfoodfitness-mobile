import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { getPlanByIdAsync, isLocalPlan } from "../../data/workoutPlans";
import { useTheme } from "../../ThemeContext";
import NotificationBell from "../../components/NotificationBell";
import ProfileButton from "../../components/ProfileButton";
import { font, radius, spacing } from "../../theme";
import TourTarget from "../../tour/TourTarget";
import { useTour } from "../../tour/TourContext";
import {
  HK_AVAILABLE,
  getTodaySteps,
  getTodayCalories,
  getLatestHeartRate,
} from "../../utils/HealthKitService";

const STEP_GOAL = 10000;

const localActiveKey = (uid) => uid ? `sff_active_local_plan_${uid}` : "sff_active_local_plan";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildWorkoutWeekdays(daysPerWeek) {
  const d = Number(daysPerWeek || 0);
  if (d <= 0) return [];
  if (d === 1) return [1];
  if (d === 2) return [2, 5];
  if (d === 3) return [1, 3, 5];
  if (d === 4) return [1, 2, 4, 5];
  if (d === 5) return [1, 2, 3, 5, 6];
  if (d === 6) return [1, 2, 3, 4, 5, 6];
  return [0, 1, 2, 3, 4, 5, 6];
}

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const dow = first.getDay();
  const start = new Date(year, month, 1 - dow);
  start.setHours(12, 0, 0, 0);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function buildScheduleMap({ year, month, weekdays, sessions }) {
  if (!sessions?.length) return {};
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // If any session has explicit weekday assignments, use those
  const hasExplicitDays = sessions.some(s => s.weekdays?.length > 0);
  if (hasExplicitDays) {
    const dowToSession = {};
    for (const sess of sessions) {
      for (const dow of (sess.weekdays || [])) {
        dowToSession[dow] = sess;
      }
    }
    const map = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      d.setHours(12, 0, 0, 0);
      const sess = dowToSession[d.getDay()];
      if (sess) map[ymd(d)] = { title: sess.title || "Workout" };
    }
    return map;
  }

  // Fallback: distribute sessions across the computed weekdays
  if (!weekdays?.length) return {};
  const monthDates = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    d.setHours(12, 0, 0, 0);
    if (weekdays.includes(d.getDay())) monthDates.push(d);
  }
  const map = {};
  let sIdx = 0;
  for (const d of monthDates) {
    const sess = sessions[sIdx % sessions.length];
    map[ymd(d)] = { title: sess?.title || "Workout" };
    sIdx++;
  }
  return map;
}

export default function FitnessScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { registerScroll } = useTour();
  const scrollRef = useRef(null);
  useEffect(() => { registerScroll("Fitness", scrollRef); }, []);
  const { auth } = useAuth();
  const userId = auth?.userId;
  const now = useMemo(() => new Date(), []);
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedKey, setSelectedKey] = useState(ymd(now));
  const [planDaysPerWeek, setPlanDaysPerWeek] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [scheduleMap, setScheduleMap] = useState({});
  const [schedMsg, setSchedMsg] = useState("");

  // ── HealthKit / Apple Watch state ─────────────────────────────────────────
  const [hkSteps, setHkSteps]       = useState(null);
  const [hkCalories, setHkCalories] = useState(null);
  const [hkHR, setHkHR]             = useState(null); // { value, date } | null

  const loadActivity = useCallback(async () => {
    if (!HK_AVAILABLE) return;
    const [steps, cals, hr] = await Promise.all([
      getTodaySteps(),
      getTodayCalories(),
      getLatestHeartRate(),
    ]);
    setHkSteps(steps);
    setHkCalories(cals);
    setHkHR(hr);
  }, []);

  useEffect(() => { loadActivity(); }, [loadActivity]);
  useFocusEffect(useCallback(() => { loadActivity(); }, [loadActivity]));

  const loadPlan = useCallback(async () => {
    if (!userId) return;
    try {
      const localId = await AsyncStorage.getItem(localActiveKey(userId)).catch(() => null);

      // Key explicitly set to "" means the user deselected / plan was deleted
      if (localId === "") {
        setPlanDaysPerWeek(null); setSessions([]); setScheduleMap({});
        setPreviewIdx(0); setSchedMsg("Select a plan to see your schedule.");
        return;
      }

      if (localId && isLocalPlan(localId)) {
        const plan = await getPlanByIdAsync(localId, userId);
        if (plan) {
          setPlanDaysPerWeek(plan.daysPerWeek || null);
          setSessions(plan.sessions || []);
          setPreviewIdx(0); setSchedMsg("");
          return;
        }
        // ID stored but plan gone (deleted) — clear key and show no-plan state
        await AsyncStorage.setItem(localActiveKey(userId), "").catch(() => {});
        setPlanDaysPerWeek(null); setSessions([]); setScheduleMap({});
        setPreviewIdx(0); setSchedMsg("Select a plan to see your schedule.");
        return;
      }

      // localId is null (key was never written) — check backend
      const prof = await apiClient.get(`/api/user-profile/${userId}`);
      const planId = prof?.data?.selectedWorkoutPlanId;
      if (!planId) {
        setPlanDaysPerWeek(null); setSessions([]); setScheduleMap({});
        setPreviewIdx(0); setSchedMsg("Select a plan to see your schedule.");
        return;
      }
      const [planRes, sessRes] = await Promise.all([
        apiClient.get(`/api/workout-plans/${planId}`),
        apiClient.get(`/api/workout-plan-sessions/plan/${planId}`),
      ]);
      const daysPerWeek = planRes?.data?.daysPerWeek ?? null;
      const sess = Array.isArray(sessRes.data) ? sessRes.data : [];
      setPlanDaysPerWeek(daysPerWeek);
      setSessions(sess);
      setPreviewIdx(0); setSchedMsg("");
    } catch {
      setPlanDaysPerWeek(null); setSessions([]); setScheduleMap({});
      setSchedMsg("Could not load schedule.");
    }
  }, [userId]);

  useEffect(() => { loadPlan(); }, [loadPlan]);
  useFocusEffect(useCallback(() => { loadPlan(); }, [loadPlan]));

  useEffect(() => {
    const weekdays = buildWorkoutWeekdays(planDaysPerWeek);
    setScheduleMap(buildScheduleMap({ year: calYear, month: calMonth, weekdays, sessions }));
  }, [planDaysPerWeek, sessions, calYear, calMonth]);

  const gridDays = useMemo(() => buildMonthGrid(calYear, calMonth), [calYear, calMonth]);

  function goMonth(delta) {
    const d = new Date(calYear, calMonth + delta, 1);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  }

  const selectedSession = scheduleMap[selectedKey] || null;

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.screen} edges={[]}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <ProfileButton onPress={() => navigation.navigate("Profile")} />
        <Text style={s.headerTitle}>Fitness</Text>
        <NotificationBell onPress={() => navigation.navigate("Notifications")} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <TourTarget tourKey="fitness_home">
        <View style={s.quickRow}>
          {[
            { label: "Encyclopedia", icon: "library-outline", screen: "ExerciseEncyclopedia" },
            { label: "Plans", icon: "list-outline", screen: "WorkoutPlans" },
            { label: "History", icon: "time-outline", screen: "WorkoutHistory" },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={s.quickCard} onPress={() => navigation.navigate(item.screen)}>
              <Ionicons name={item.icon} size={22} color={colors.primary} />
              <Text style={s.quickCardText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        </TourTarget>

        {/* Today's Activity */}
        <TourTarget tourKey="fitness_activity">
        {HK_AVAILABLE && (
          <TouchableOpacity style={s.activityCard} onPress={() => navigation.navigate("ActivityTracking")} activeOpacity={0.8}>
            <View style={s.activityCardHeader}>
              <View style={s.activityCardLeft}>
                <Ionicons name="watch-outline" size={18} color="#ef4444" />
                <Text style={s.activityCardTitle}>Today's Activity</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </View>

            {/* Steps row with progress bar */}
            <View style={s.activityRow}>
              <View style={[s.activityIconWrap, { backgroundColor: "#22c55e20" }]}>
                <Ionicons name="footsteps-outline" size={16} color="#22c55e" />
              </View>
              <View style={s.activityInfo}>
                <View style={s.activityLabelRow}>
                  <Text style={s.activityLabel}>Steps</Text>
                  <Text style={[s.activityValue, { color: "#22c55e" }]}>
                    {hkSteps != null ? hkSteps.toLocaleString() : "—"}
                    <Text style={s.activityGoal}> / {STEP_GOAL.toLocaleString()}</Text>
                  </Text>
                </View>
                <View style={s.progressBarWrap}>
                  <View style={[s.progressBar, { backgroundColor: "#22c55e", width: `${Math.min(100, ((hkSteps || 0) / STEP_GOAL) * 100)}%` }]} />
                </View>
              </View>
            </View>

            {/* Calories + Heart Rate row */}
            <View style={s.activityMetaRow}>
              <View style={s.activityMeta}>
                <View style={[s.activityIconWrap, { backgroundColor: "#f9731620" }]}>
                  <Ionicons name="flame-outline" size={16} color="#f97316" />
                </View>
                <View>
                  <Text style={s.activityMetaVal}>
                    {hkCalories != null ? hkCalories.toLocaleString() : "—"}
                    <Text style={s.activityMetaUnit}> kcal</Text>
                  </Text>
                  <Text style={s.activityMetaLbl}>Active calories</Text>
                </View>
              </View>
              <View style={s.activityMetaDivider} />
              <View style={s.activityMeta}>
                <View style={[s.activityIconWrap, { backgroundColor: "#ef444420" }]}>
                  <Ionicons name="heart-outline" size={16} color="#ef4444" />
                </View>
                <View>
                  <Text style={s.activityMetaVal}>
                    {hkHR ? hkHR.value : "—"}
                    <Text style={s.activityMetaUnit}> bpm</Text>
                  </Text>
                  <Text style={s.activityMetaLbl}>Heart rate</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
        </TourTarget>

        <TourTarget tourKey="fitness_weight">
          <TouchableOpacity style={s.weightTrackCard} onPress={() => navigation.navigate("WeightTracking")}>
            <View style={s.weightTrackLeft}>
              <Ionicons name="barbell-outline" size={20} color={colors.primary} />
              <View>
                <Text style={s.weightTrackTitle}>Weight Tracking</Text>
                <Text style={s.weightTrackSub}>View & update exercise defaults</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </TourTarget>

        <TourTarget tourKey="fitness_schedule">
        <View style={s.card}>
          <Text style={s.cardTitle}>Workout Schedule</Text>
          <View style={s.calNav}>
            <TouchableOpacity style={s.calArrow} onPress={() => goMonth(-1)}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={s.calMonthLabel}>{MONTHS[calMonth]} {calYear}</Text>
            <TouchableOpacity style={s.calArrow} onPress={() => goMonth(1)}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={s.calGrid}>
            {WEEKDAYS.map((w) => <Text key={w} style={s.calDow}>{w}</Text>)}
            {gridDays.map((d) => {
              const inMonth = d.getMonth() === calMonth;
              const key = ymd(d);
              const hasWorkout = !!scheduleMap[key];
              const isSelected = key === selectedKey;
              return (
                <TouchableOpacity key={key} style={[s.calCell, isSelected && s.calCellOn, !inMonth && s.calCellOff]} onPress={() => setSelectedKey(key)}>
                  <Text style={[s.calDay, isSelected && s.calDayOn, !inMonth && s.calDayOff]}>{d.getDate()}</Text>
                  {hasWorkout ? <View style={[s.calDot, isSelected && s.calDotOn]} /> : <View style={s.calDotSpacer} />}
                </TouchableOpacity>
              );
            })}
          </View>
          {schedMsg ? <Text style={s.schedMsg}>{schedMsg}</Text> : (
            <View style={s.calSelected}>
              <Text style={s.calSelectedDate}>{selectedKey}</Text>
              <View style={[s.calBadge, selectedSession ? s.calBadgeOn : s.calBadgeOff]}>
                <Text style={[s.calBadgeText, selectedSession ? s.calBadgeTextOn : null]}>
                  {selectedSession ? "Workout Day" : "Rest Day"}
                </Text>
              </View>
              <Text style={s.calSessionTitle}>{selectedSession ? selectedSession.title : "No session planned."}</Text>
            </View>
          )}
        </View>
        </TourTarget>

        <TourTarget tourKey="fitness_next">
        <View style={s.card}>
          <View style={s.sessionCardHeader}>
            <Text style={s.cardTitle}>Next Session</Text>
            {sessions.length > 1 && (
              <View style={s.sessionNav}>
                <TouchableOpacity
                  style={[s.sessionNavBtn, previewIdx === 0 && s.sessionNavBtnOff]}
                  onPress={() => setPreviewIdx(i => Math.max(0, i - 1))}
                  disabled={previewIdx === 0}
                >
                  <Ionicons name="chevron-back" size={16} color={previewIdx === 0 ? colors.textSecondary : colors.primary} />
                </TouchableOpacity>
                <Text style={s.sessionNavLabel}>{previewIdx + 1}/{sessions.length}</Text>
                <TouchableOpacity
                  style={[s.sessionNavBtn, previewIdx >= sessions.length - 1 && s.sessionNavBtnOff]}
                  onPress={() => setPreviewIdx(i => Math.min(sessions.length - 1, i + 1))}
                  disabled={previewIdx >= sessions.length - 1}
                >
                  <Ionicons name="chevron-forward" size={16} color={previewIdx >= sessions.length - 1 ? colors.textSecondary : colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          {sessions.length > 0 ? (() => {
            const sess = sessions[previewIdx];
            const exerciseNames = (sess?.exercises || []).slice(0, 3).map(e => e.name).filter(Boolean).join(", ");
            return (
              <View style={s.previewWrap}>
                <Text style={s.previewTitle}>{sess?.title || "Workout"}</Text>
                {exerciseNames ? <Text style={s.previewSub}>Exercises: {exerciseNames}</Text> : null}
              </View>
            );
          })() : (
            <View style={s.emptyState}>
              <Ionicons name="barbell-outline" size={28} color={colors.textLight} />
              <Text style={s.previewSub}>Select a workout plan to see your next session.</Text>
            </View>
          )}
          <TouchableOpacity
            style={s.startBtn}
            onPress={() => navigation.navigate("Workout", sessions.length > 0 ? { sessionIndex: previewIdx } : undefined)}
          >
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={s.startBtnText}>Start Workout</Text>
          </TouchableOpacity>
        </View>
        </TourTarget>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xs },
    quickRow: { flexDirection: "row", gap: spacing.sm },
    quickCard: {
      flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
      padding: spacing.md, alignItems: "center", gap: 6,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    quickCardText: { fontSize: 11, fontWeight: font.semiBold, color: colors.text, textAlign: "center" },
    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    calNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    calArrow: { padding: spacing.sm },
    calMonthLabel: { fontSize: font.base, fontWeight: font.semiBold, color: colors.text },
    calGrid: { flexDirection: "row", flexWrap: "wrap" },
    calDow: { width: "14.28%", textAlign: "center", fontSize: 11, fontWeight: font.bold, color: colors.textSecondary, paddingVertical: 4 },
    calCell: { width: "14.28%", alignItems: "center", paddingVertical: 4, borderRadius: radius.sm },
    calCellOn: { backgroundColor: colors.primary },
    calCellOff: { opacity: 0.3 },
    calDay: { fontSize: 13, color: colors.text },
    calDayOn: { color: "#fff", fontWeight: font.bold },
    calDayOff: { color: colors.textLight },
    calDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 2 },
    calDotOn: { backgroundColor: "#fff" },
    calDotSpacer: { width: 5, height: 5, marginTop: 2 },
    schedMsg: { fontSize: font.sm, color: colors.textSecondary, textAlign: "center" },
    calSelected: { gap: 4 },
    calSelectedDate: { fontSize: font.sm, color: colors.textSecondary },
    calBadge: { alignSelf: "flex-start", borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 3 },
    calBadgeOn: { backgroundColor: colors.insightBg },
    calBadgeOff: { backgroundColor: colors.border },
    calBadgeText: { fontSize: font.sm, color: colors.textSecondary },
    calBadgeTextOn: { color: colors.primary, fontWeight: font.semiBold },
    calSessionTitle: { fontSize: font.base, fontWeight: font.semiBold, color: colors.text },
    sessionCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sessionNav: { flexDirection: "row", alignItems: "center", gap: 4 },
    sessionNavBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    sessionNavBtnOff: { opacity: 0.35 },
    sessionNavLabel: { fontSize: font.sm, color: colors.textSecondary, minWidth: 28, textAlign: "center" },
    previewWrap: { gap: 6 },
    previewTitle: { fontSize: font.base, fontWeight: font.bold, color: colors.text },
    previewSub: { fontSize: font.sm, color: colors.textSecondary },
    emptyState: { alignItems: "center", gap: 8, paddingVertical: spacing.sm },
    startBtn: {
      backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 12,
      alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    startBtnText: { color: "#fff", fontSize: font.base, fontWeight: font.semiBold },
    weightTrackCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    weightTrackLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    weightTrackTitle: { fontSize: font.base, fontWeight: font.semiBold, color: colors.text },
    weightTrackSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },

    // Today's Activity card
    activityCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    activityCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    activityCardLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    activityCardTitle: { fontSize: font.base, fontWeight: font.bold, color: colors.text },
    activityRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    activityIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    activityInfo: { flex: 1, gap: 5 },
    activityLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    activityLabel: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.textSecondary },
    activityValue: { fontSize: font.sm, fontWeight: "800" },
    activityGoal: { fontSize: 10, fontWeight: "500", color: colors.textSecondary },
    progressBarWrap: { height: 6, backgroundColor: colors.border, borderRadius: radius.full, overflow: "hidden" },
    progressBar: { height: "100%", borderRadius: radius.full },
    activityMetaRow: { flexDirection: "row", alignItems: "center" },
    activityMeta: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    activityMetaDivider: { width: 1, height: 36, backgroundColor: colors.border, marginHorizontal: spacing.sm },
    activityMetaVal: { fontSize: font.base, fontWeight: "800", color: colors.text },
    activityMetaUnit: { fontSize: 11, fontWeight: "500", color: colors.textSecondary },
    activityMetaLbl: { fontSize: 10, color: colors.textSecondary, fontWeight: "600", marginTop: 1 },
  });
}
