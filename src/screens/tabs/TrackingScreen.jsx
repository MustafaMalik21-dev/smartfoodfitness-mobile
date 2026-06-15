import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import NotificationBell from "../../components/NotificationBell";
import ProfileButton from "../../components/ProfileButton";
import { font, radius, spacing } from "../../theme";
import TourTarget from "../../tour/TourTarget";
import { useTour } from "../../tour/TourContext";

const WEEKLY_TARGET = 5;
const MONTHLY_TARGET = 20;

function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

function convertWeight(value, fromUnit, toUnit) {
  const f = String(fromUnit || "kg").toLowerCase();
  const t = String(toUnit  || "kg").toLowerCase();
  if (f === t) return value;
  if (f === "kg"  && t === "lbs") return value * 2.20462;
  if (f === "lbs" && t === "kg")  return value / 2.20462;
  return value;
}

function normalizeWeightEntries(raw, displayUnit = "kg") {
  return (Array.isArray(raw) ? raw : [])
    .map((e) => {
      if (!e?.recordedAt) return null;
      const converted = convertWeight(toNumber(e.weightValue), e.weightUnit || "kg", displayUnit);
      return { at: e.recordedAt, value: converted };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.at) - new Date(b.at));
}

function computeWorkoutStats(logs) {
  const list = Array.isArray(logs) ? logs : [];
  const now = new Date();
  const weekStart = startOfDay(now);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() + ((day === 0 ? -6 : 1) - day));
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  let weeklyCount = 0, monthlyCount = 0, monthlyMinutes = 0;
  for (const w of list) {
    const dt = new Date(w.performedAt || w.completedAt);
    if (isNaN(dt.getTime())) continue;
    if (dt >= weekStart) weeklyCount++;
    if (dt >= monthStart) { monthlyCount++; monthlyMinutes += toNumber(w.durationMinutes); }
  }
  return { weeklyCount, monthlyCount, hoursThisMonth: monthlyMinutes / 60 };
}

export default function TrackingScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const { registerScroll } = useTour();
  const scrollRef = useRef(null);
  useEffect(() => { registerScroll("Tracking", scrollRef); }, []);
  const userId = auth?.userId;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [weightEntries, setWeightEntries] = useState([]);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [weightUnit, setWeightUnit] = useState("kg");

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      setLoading(true); setErr("");

      // Read weight unit from settings
      let wu = "kg";
      try {
        const raw = await AsyncStorage.getItem("sff_settings_v1");
        const parsed = raw ? JSON.parse(raw) : null;
        wu = parsed?.units?.weight || "kg";
      } catch {}
      setWeightUnit(wu);

      const [wRes, lRes] = await Promise.all([
        apiClient.get(`/api/weight-entries/user/${userId}`),
        apiClient.get(`/api/workout-logs/user/${userId}`),
      ]);
      setWeightEntries(normalizeWeightEntries(wRes.data, wu));
      setWorkoutLogs(Array.isArray(lRes.data) ? lRes.data : []);
    } catch {
      setErr("Failed to load tracking data.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const workoutStats = useMemo(() => computeWorkoutStats(workoutLogs), [workoutLogs]);

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.screen} edges={[]}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <ProfileButton onPress={() => navigation.navigate("Profile")} />
        <Text style={s.headerTitle}>Tracking</Text>
        <NotificationBell onPress={() => navigation.navigate("Notifications")} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {err ? <Text style={s.errText}>{err}</Text> : null}
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : null}

        {/* Body Tracking */}
        <TourTarget tourKey="tracking_body">
        <TouchableOpacity style={s.card} onPress={() => navigation.navigate("BodyTracking")} activeOpacity={0.8}>
          <View style={s.cardTitleRow}>
            <View style={s.cardTitleLeft}>
              <Ionicons name="body-outline" size={18} color={colors.primary} />
              <Text style={s.cardTitle}>Body Tracking</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
          <View style={s.bodyTrackingRow}>
            {[
              { label: "Weight",   icon: "scale-outline",    color: "#0b84ff" },
              { label: "Body Fat", icon: "water-outline",    color: "#f97316" },
              { label: "Muscle",   icon: "barbell-outline",  color: "#6366f1" },
              { label: "BMI",      icon: "body-outline",     color: "#22c55e" },
            ].map(({ label, icon, color }) => {
              const latest = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1] : null;
              const val = label === "Weight" && latest ? `${latest.value.toFixed(1)} ${weightUnit}` : null;
              return (
                <View key={label} style={s.bodyTrackingItem}>
                  <View style={[s.bodyTrackingIcon, { backgroundColor: color + "20" }]}>
                    <Ionicons name={icon} size={18} color={color} />
                  </View>
                  <Text style={s.bodyTrackingLabel}>{label}</Text>
                  {val ? (
                    <Text style={[s.bodyTrackingVal, { color }]}>{val}</Text>
                  ) : (
                    <Ionicons name="bluetooth-outline" size={12} color={colors.textLight} />
                  )}
                </View>
              );
            })}
          </View>
          <Text style={s.bodyTrackingHint}>Tap to view full charts and connect your scale</Text>
        </TouchableOpacity>
        </TourTarget>

        {/* Food Tracking */}
        <TourTarget tourKey="tracking_food">
        <TouchableOpacity style={s.card} onPress={() => navigation.navigate("FoodTracking")} activeOpacity={0.8}>
          <View style={s.cardTitleRow}>
            <View style={s.cardTitleLeft}>
              <Ionicons name="nutrition-outline" size={18} color="#f97316" />
              <Text style={s.cardTitle}>Food Tracking</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
          <View style={s.bodyTrackingRow}>
            {[
              { label: "Calories", icon: "flame-outline",     color: "#f97316" },
              { label: "Macros",   icon: "nutrition-outline",  color: "#3b82f6" },
              { label: "Micros",   icon: "flask-outline",      color: "#8b5cf6" },
              { label: "Water",    icon: "water-outline",      color: "#0ea5e9" },
            ].map(({ label, icon, color }) => (
              <View key={label} style={s.bodyTrackingItem}>
                <View style={[s.bodyTrackingIcon, { backgroundColor: color + "20" }]}>
                  <Ionicons name={icon} size={18} color={color} />
                </View>
                <Text style={s.bodyTrackingLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <Text style={s.bodyTrackingHint}>Tap to view detailed food & nutrition charts</Text>
        </TouchableOpacity>
        </TourTarget>

        {/* Workout Tracking */}
        <TourTarget tourKey="tracking_workout">
        <TouchableOpacity style={s.card} onPress={() => navigation.navigate("WorkoutTracking")} activeOpacity={0.8}>
          <View style={s.cardTitleRow}>
            <View style={s.cardTitleLeft}>
              <Ionicons name="barbell-outline" size={18} color="#22c55e" />
              <Text style={s.cardTitle}>Workout Tracking</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
          <View style={s.bodyTrackingRow}>
            {[
              { label: "Duration",  icon: "timer-outline",    color: "#f97316" },
              { label: "Volume",    icon: "barbell-outline",  color: "#6366f1" },
              { label: "Frequency", icon: "calendar-outline", color: "#22c55e" },
              { label: "Records",   icon: "trophy-outline",   color: "#f59e0b" },
            ].map(({ label, icon, color }) => (
              <View key={label} style={s.bodyTrackingItem}>
                <View style={[s.bodyTrackingIcon, { backgroundColor: color + "20" }]}>
                  <Ionicons name={icon} size={18} color={color} />
                </View>
                <Text style={s.bodyTrackingLabel}>{label}</Text>
              </View>
            ))}
          </View>
          {workoutLogs.length === 0 && !loading ? (
            <Text style={s.bodyTrackingHint}>Complete workouts to see your stats and trends.</Text>
          ) : (
            <View style={s.workoutQuickStats}>
              <View style={s.quickStatItem}>
                <Text style={s.quickStatVal}>{workoutStats.weeklyCount}</Text>
                <Text style={s.quickStatLbl}>This week</Text>
              </View>
              <View style={s.quickStatDivider} />
              <View style={s.quickStatItem}>
                <Text style={s.quickStatVal}>{workoutStats.monthlyCount}</Text>
                <Text style={s.quickStatLbl}>This month</Text>
              </View>
              <View style={s.quickStatDivider} />
              <View style={s.quickStatItem}>
                <Text style={s.quickStatVal}>{Math.max(0, workoutStats.hoursThisMonth).toFixed(1)}h</Text>
                <Text style={s.quickStatLbl}>Hours logged</Text>
              </View>
            </View>
          )}
          <Text style={s.bodyTrackingHint}>Tap to view detailed workout charts</Text>
        </TouchableOpacity>
        </TourTarget>

        {/* Activity Tracking (HealthKit — Apple Watch) */}
        <TourTarget tourKey="tracking_activity">
        <TouchableOpacity style={s.card} onPress={() => navigation.navigate("ActivityTracking")} activeOpacity={0.8}>
          <View style={s.cardTitleRow}>
            <View style={s.cardTitleLeft}>
              <Ionicons name="watch-outline" size={18} color="#ef4444" />
              <Text style={s.cardTitle}>Activity Tracking</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
          <View style={s.bodyTrackingRow}>
            {[
              { label: "Steps",      icon: "footsteps-outline", color: "#22c55e" },
              { label: "Calories",   icon: "flame-outline",     color: "#f97316" },
              { label: "Heart Rate", icon: "heart-outline",     color: "#ef4444" },
            ].map(({ label, icon, color }) => (
              <View key={label} style={s.bodyTrackingItem}>
                <View style={[s.bodyTrackingIcon, { backgroundColor: color + "20" }]}>
                  <Ionicons name={icon} size={18} color={color} />
                </View>
                <Text style={s.bodyTrackingLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <Text style={s.bodyTrackingHint}>Steps, active calories & heart rate via Apple Watch</Text>
        </TouchableOpacity>
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
    errText: { color: colors.error, fontSize: font.sm, textAlign: "center" },
    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardTitleLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    bodyTrackingRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
    bodyTrackingItem: { flex: 1, alignItems: "center", gap: 5 },
    bodyTrackingIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    bodyTrackingLabel: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
    bodyTrackingVal: { fontSize: 11, fontWeight: "800" },
    bodyTrackingHint: { fontSize: 11, color: colors.textLight, textAlign: "center", marginTop: spacing.sm },
    emptyState: { alignItems: "center", paddingVertical: spacing.xl, gap: 6 },
    empty: { color: colors.textSecondary, fontSize: font.sm, textAlign: "center" },
    emptySub: { color: colors.textSecondary, fontSize: font.sm, textAlign: "center", opacity: 0.7 },
    statRow: { gap: spacing.sm },
    statLeft: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    statLabel: { fontSize: font.sm, color: colors.textSecondary },
    statValue: { fontSize: font.sm, fontWeight: font.bold, color: colors.text },
    progressBarWrap: { height: 6, backgroundColor: colors.border, borderRadius: radius.full, overflow: "hidden" },
    progressBar: { height: "100%", backgroundColor: colors.primary, borderRadius: radius.full },
    workoutQuickStats: {
      flexDirection: "row", justifyContent: "space-around", alignItems: "center",
      paddingVertical: spacing.sm, backgroundColor: colors.background, borderRadius: radius.md,
    },
    quickStatItem: { alignItems: "center", gap: 2 },
    quickStatVal:  { fontSize: 18, fontWeight: "800", color: "#22c55e" },
    quickStatLbl:  { fontSize: 10, color: colors.textSecondary, fontWeight: "600" },
    quickStatDivider: { width: 1, height: 28, backgroundColor: colors.border },
  });
}
