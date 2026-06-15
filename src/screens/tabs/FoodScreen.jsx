import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Svg, Circle as SvgCircle, Path as SvgPath, G, Text as SvgText } from "react-native-svg";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import NotificationBell from "../../components/NotificationBell";
import ProfileButton from "../../components/ProfileButton";
import { font, radius, spacing } from "../../theme";
import TourTarget from "../../tour/TourTarget";
import { useTour } from "../../tour/TourContext";

const MICRO_KEY      = "sff_show_micros";
const MICRO_RDI_KEY  = "sff_micro_rdis";
const WATER_GOAL_KEY = "sff_water_goal_ml";
const WATER_PRESETS = [
  { label: "Glass",  ml: 200 },
  { label: "Can",    ml: 330 },
  { label: "Bottle", ml: 500 },
  { label: "Large",  ml: 750 },
];
const RING_R    = 62;   // SVG ring radius
const RING_SIZE = 160;  // SVG canvas size
const RING_SW   = 10;   // stroke width
const RING_CIRC = 2 * Math.PI * RING_R;

// Single source of truth: key → logKey, label, unit, RDI, color
const MICRO_META = [
  { key: "fiber",        logKey: "fiberG",        label: "Fiber",       unit: "g",   rdi: 30,   color: "#06b6d4" },
  { key: "sugar",        logKey: "sugarG",        label: "Sugar",       unit: "g",   rdi: 50,   color: "#f472b6" },
  { key: "saturatedFat", logKey: "saturatedFatG", label: "Sat. Fat",    unit: "g",   rdi: 20,   color: "#f97316" },
  { key: "sodium",       logKey: "sodiumMg",      label: "Sodium",      unit: "mg",  rdi: 2300, color: "#eab308" },
  { key: "potassium",    logKey: "potassiumMg",   label: "Potassium",   unit: "mg",  rdi: 4700, color: "#7c3aed" },
  { key: "cholesterol",  logKey: "cholesterolMg", label: "Cholesterol", unit: "mg",  rdi: 300,  color: "#d946ef" },
  { key: "calcium",      logKey: "calciumMg",     label: "Calcium",     unit: "mg",  rdi: 1000, color: "#3b82f6" },
  { key: "iron",         logKey: "ironMg",        label: "Iron",        unit: "mg",  rdi: 18,   color: "#b45309" },
  { key: "zinc",         logKey: "zincMg",        label: "Zinc",        unit: "mg",  rdi: 11,   color: "#10b981" },
  { key: "vitaminA",     logKey: "vitaminAMcg",   label: "Vitamin A",   unit: "mcg", rdi: 900,  color: "#f59e0b" },
  { key: "vitaminC",     logKey: "vitaminCMg",    label: "Vitamin C",   unit: "mg",  rdi: 90,   color: "#22c55e" },
  { key: "vitaminD",     logKey: "vitaminDMcg",   label: "Vitamin D",   unit: "mcg", rdi: 20,   color: "#8b5cf6" },
];

// Export for use in LogFoodScreen
export { MICRO_META };

function toN(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default function FoodScreen({ navigation }) {
  const { colors } = useTheme();
  const { auth } = useAuth();
  const { registerScroll } = useTour();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  useEffect(() => { registerScroll("Food", scrollRef); }, []);
  const userId = auth?.userId;

  const [logs, setLogs] = useState([]);
  const [goals, setGoals] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showMicros, setShowMicros] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Water tracking state
  const [waterLogs, setWaterLogs] = useState([]);
  const [waterModalOpen, setWaterModalOpen] = useState(false);
  const [waterCustom, setWaterCustom] = useState("");
  const [waterSaving, setWaterSaving] = useState(false);
  const [waterErr, setWaterErr] = useState("");

  // Water goal override (null = use body-weight formula)
  const [waterGoalOverride, setWaterGoalOverride] = useState(null);
  const [waterGoalEditOpen, setWaterGoalEditOpen] = useState(false);
  const [waterGoalDraft, setWaterGoalDraft] = useState("");

  // Macro / calorie goal editing
  const [goalEditOpen, setGoalEditOpen] = useState(false);
  const [goalDraft, setGoalDraft]       = useState({ protein: "", carbs: "", fat: "" });
  const [goalSaving, setGoalSaving]     = useState(false);
  const [goalErr, setGoalErr]           = useState("");

  // Micro RDI overrides
  const [microRdiOverrides, setMicroRdiOverrides] = useState({});
  const [microEditOpen, setMicroEditOpen]         = useState(false);
  const [microRdiDraft, setMicroRdiDraft]         = useState({});

  useEffect(() => {
    AsyncStorage.getItem(MICRO_KEY).then((v) => { if (v === "true") setShowMicros(true); });
    AsyncStorage.getItem(MICRO_RDI_KEY).then((v) => { if (v) { try { setMicroRdiOverrides(JSON.parse(v)); } catch {} } });
    AsyncStorage.getItem(WATER_GOAL_KEY).then((v) => { if (v) { const n = Number(v); if (n > 0) setWaterGoalOverride(n); } });
  }, []);

  function toggleMicros() {
    setShowMicros((prev) => {
      const next = !prev;
      AsyncStorage.setItem(MICRO_KEY, String(next));
      return next;
    });
  }

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [logsRes, goalsRes, profileRes, waterRes] = await Promise.all([
        apiClient.get(`/api/food-entry-logs/user/${userId}`),
        apiClient.get(`/api/user-goals/user/${userId}`).catch(() => ({ data: null })),
        apiClient.get(`/api/profile/user/${userId}`).catch(() => ({ data: null })),
        apiClient.get(`/api/water-entries/user/${userId}/today`).catch(() => ({ data: { totalMl: 0 } })),
      ]);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      setLogs((logsRes.data || []).filter((x) => new Date(x.loggedAt) >= todayStart));
      setGoals(goalsRes.data || null);
      setProfile(profileRes.data || null);
      setWaterLogs(waterRes.data?.totalMl != null ? waterRes.data : { totalMl: 0 });
    } catch {
      setLogs([]);
      setGoals(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Recommended daily water in ml — user override takes precedence, else 35 ml/kg clamped 2000–4000
  const recommendedWaterMl = useMemo(() => {
    if (waterGoalOverride != null && waterGoalOverride > 0) return waterGoalOverride;
    if (!profile?.weightValue) return 2500;
    let wKg = profile.weightValue;
    if (String(profile.weightUnit || "kg").toLowerCase() === "lbs") wKg *= 0.453592;
    return Math.round(Math.min(4000, Math.max(2000, wKg * 35)));
  }, [profile, waterGoalOverride]);

  const waterIntakeMl = toN(waterLogs?.totalMl);
  const waterPct      = Math.min(1, waterIntakeMl / recommendedWaterMl);
  const waterOffset   = RING_CIRC * (1 - waterPct);

  async function logWater(ml) {
    if (!ml || ml <= 0) { setWaterErr("Enter a valid amount."); return; }
    setWaterSaving(true); setWaterErr("");
    try {
      await apiClient.post("/api/water-entries", {
        userId, waterMl: ml, loggedAt: new Date().toISOString(),
      });
      setWaterModalOpen(false); setWaterCustom("");
      load();
    } catch {
      setWaterErr("Could not save. Try again.");
    } finally {
      setWaterSaving(false);
    }
  }

  // Returns the active RDI for a micro key (user override or default)
  function effectiveRdi(key, defaultRdi) {
    const ov = toN(microRdiOverrides[key]);
    return ov > 0 ? ov : defaultRdi;
  }

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

  async function saveWaterGoal() {
    const ml = Math.round(toN(waterGoalDraft));
    if (!ml || ml < 500 || ml > 8000) { return; }
    await AsyncStorage.setItem(WATER_GOAL_KEY, String(ml));
    setWaterGoalOverride(ml);
    setWaterGoalEditOpen(false);
  }

  async function saveMicroRdis() {
    const merged = { ...microRdiOverrides };
    MICRO_META.forEach(({ key }) => {
      const v = toN(microRdiDraft[key]);
      if (v > 0) merged[key] = v;
    });
    await AsyncStorage.setItem(MICRO_RDI_KEY, JSON.stringify(merged));
    setMicroRdiOverrides(merged);
    setMicroEditOpen(false);
  }

  const totals = useMemo(() => ({
    protein:  Math.round(logs.reduce((a, x) => a + toN(x.proteins), 0)),
    carbs:    Math.round(logs.reduce((a, x) => a + toN(x.carbs), 0)),
    fat:      Math.round(logs.reduce((a, x) => a + toN(x.fats), 0)),
    calories: Math.round(logs.reduce((a, x) => a + toN(x.calories), 0)),
  }), [logs]);

  const macroGoals = useMemo(() => {
    const g = goals || {};
    const protein = toN(g.proteinGoal) || 150;
    const carbs   = toN(g.carbGoal || g.carbohydrateGoal) || 200;
    const fat     = toN(g.fatGoal) || 65;
    return { protein, carbs, fat, calories: protein * 4 + carbs * 4 + fat * 9 };
  }, [goals]);

  const macroBars = useMemo(() => [
    { label: "Calories", value: totals.calories, goal: macroGoals.calories, unit: "kcal", color: colors.primary   || "#0b84ff" },
    { label: "Protein",  value: totals.protein,  goal: macroGoals.protein,  unit: "g",    color: colors.protein   || "#6366f1" },
    { label: "Carbs",    value: totals.carbs,     goal: macroGoals.carbs,    unit: "g",    color: colors.carbs     || "#f59e0b" },
    { label: "Fat",      value: totals.fat,       goal: macroGoals.fat,      unit: "g",    color: colors.fat       || "#22c55e" },
  ], [totals, macroGoals, colors]);

  const microTotals = useMemo(() => {
    const obj = {};
    MICRO_META.forEach(({ key, logKey }) => {
      const total = logs.reduce((a, x) => a + (x[logKey] != null ? Number(x[logKey]) : 0), 0);
      obj[key] = Math.round(total * 10) / 10;
    });
    return obj;
  }, [logs]);

  const hasMicroData = useMemo(
    () => Object.values(microTotals).some((v) => v > 0),
    [microTotals]
  );

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.screen} edges={[]}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <ProfileButton onPress={() => navigation.navigate("Profile")} />
        <Text style={s.headerTitle}>Food</Text>
        <NotificationBell onPress={() => navigation.navigate("Notifications")} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <TourTarget tourKey="food_log_btn">
          <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.navigate("LogFood")}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={s.primaryBtnText}>Log Food</Text>
          </TouchableOpacity>
        </TourTarget>

        {/* ── Today's Food Log ── */}
        <TourTarget tourKey="food_log">
          <View style={s.card}>
            <Text style={s.cardTitle}>Today's Food Log</Text>
            <View style={s.tableHead}>
              <Text style={[s.th, { flex: 2 }]}>Food</Text>
              <Text style={[s.th, { flex: 1, textAlign: "center" }]}>Weight</Text>
              <Text style={[s.th, { flex: 1, textAlign: "right", paddingRight: 28 }]}>kcal</Text>
            </View>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : logs.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="restaurant-outline" size={32} color={colors.textLight} />
                <Text style={s.empty}>No food logged yet today</Text>
                <Text style={s.emptySub}>Tap "Log Food" to get started</Text>
              </View>
            ) : (
              logs.map((x) => {
                const isOpen = expandedLogId === x.id;
                const logMicros = MICRO_META.filter(({ logKey }) => x[logKey] != null && Number(x[logKey]) > 0);
                const hasMicros = logMicros.length > 0;
                return (
                  <View key={x.id}>
                    <TouchableOpacity
                      style={s.tableRow}
                      onPress={() => hasMicros && setExpandedLogId(isOpen ? null : x.id)}
                      activeOpacity={hasMicros ? 0.65 : 1}
                    >
                      <Text style={[s.td, { flex: 2 }]} numberOfLines={1}>{x.foodName}</Text>
                      <Text style={[s.td, { flex: 1, textAlign: "center" }]}>{x.weightValue}{x.weightUnit}</Text>
                      <Text style={[s.tdBold, { flex: 1, textAlign: "right" }]}>{x.calories}</Text>
                      <View style={s.expandIcon}>
                        {hasMicros
                          ? <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.textSecondary} />
                          : <View style={{ width: 14 }} />
                        }
                      </View>
                    </TouchableOpacity>
                    {isOpen && hasMicros && (
                      <View style={s.microChips}>
                        {logMicros.map(({ logKey, label, unit, color }) => {
                          const val = Math.round(Number(x[logKey]) * 10) / 10;
                          return (
                            <View key={logKey} style={[s.microChip, { backgroundColor: color + "22" }]}>
                              <View style={[s.microChipDot, { backgroundColor: color }]} />
                              <Text style={[s.microChipText, { color }]}>{label}</Text>
                              <Text style={[s.microChipVal, { color }]}>{val}{unit}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })
            )}
            {logs.length > 0 && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Total</Text>
                <Text style={s.totalValue}>{logs.reduce((a, x) => a + (x.calories || 0), 0)} kcal</Text>
              </View>
            )}
          </View>
        </TourTarget>

        {/* ── Daily Water Intake ── */}
        <TourTarget tourKey="food_water">
        <View style={s.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="water" size={18} color="#0ea5e9" />
              <Text style={s.cardTitle}>Daily Water</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={s.chartSub}>{Math.round(waterIntakeMl)} / {recommendedWaterMl} ml</Text>
              <TouchableOpacity
                onPress={() => { setWaterGoalDraft(String(recommendedWaterMl)); setWaterGoalEditOpen(true); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Ring + info row */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
            {/* SVG circular ring */}
            <Svg width={RING_SIZE} height={RING_SIZE}>
              {/* Background track */}
              <SvgCircle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                stroke={colors.border} strokeWidth={RING_SW} fill="none"
              />
              {/* Progress arc */}
              <SvgCircle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                stroke="#0ea5e9" strokeWidth={RING_SW} fill="none"
                strokeDasharray={`${RING_CIRC}`}
                strokeDashoffset={waterOffset}
                strokeLinecap="round"
                rotation="-90"
                origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
              />
              {/* Droplet symbol */}
              <SvgPath
                d="M80,52 C80,52 68,67 68,76 C68,83.7 73.4,90 80,90 C86.6,90 92,83.7 92,76 C92,67 80,52 80,52 Z"
                fill="#0ea5e9"
                opacity="0.85"
              />
              {/* Percentage text */}
              <SvgText
                x={RING_SIZE / 2} y={RING_SIZE / 2 + 28}
                textAnchor="middle" fontSize={13} fontWeight="700"
                fill="#0ea5e9"
              >
                {Math.round(waterPct * 100)}%
              </SvgText>
            </Svg>

            {/* Info column */}
            <View style={{ flex: 1, gap: spacing.sm }}>
              <View style={s.waterStatRow}>
                <Text style={s.waterStatLabel}>Intake today</Text>
                <Text style={[s.waterStatVal, { color: "#0ea5e9" }]}>{Math.round(waterIntakeMl)} ml</Text>
              </View>
              <View style={s.waterStatRow}>
                <Text style={s.waterStatLabel}>Daily goal</Text>
                <Text style={s.waterStatVal}>{recommendedWaterMl} ml</Text>
              </View>
              <View style={s.waterStatRow}>
                <Text style={s.waterStatLabel}>Remaining</Text>
                <Text style={s.waterStatVal}>{Math.max(0, recommendedWaterMl - Math.round(waterIntakeMl))} ml</Text>
              </View>
              <TouchableOpacity style={s.waterLogBtn} onPress={() => { setWaterErr(""); setWaterCustom(""); setWaterModalOpen(true); }}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={s.waterLogBtnText}>Log Water</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick preset buttons */}
          <View style={s.waterPresets}>
            {WATER_PRESETS.map(({ label, ml }) => (
              <TouchableOpacity key={label} style={s.waterPresetBtn} onPress={() => logWater(ml)}>
                <Text style={s.waterPresetLabel}>{label}</Text>
                <Text style={s.waterPresetMl}>{ml}ml</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        </TourTarget>

        {/* Water Log Modal */}
        <Modal visible={waterModalOpen} transparent animationType="slide" onRequestClose={() => setWaterModalOpen(false)}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={[s.modalOverlay, { paddingBottom: insets.bottom + spacing.lg }]}>
              <View style={s.modalSheet}>
                <Text style={s.modalTitle}>Log Water Intake</Text>
                <Text style={s.modalSub}>Enter amount in millilitres</Text>
                <TextInput
                  style={s.modalInput}
                  keyboardType="numeric"
                  placeholder="e.g. 250"
                  placeholderTextColor={colors.textLight}
                  value={waterCustom}
                  onChangeText={setWaterCustom}
                  returnKeyType="done"
                  onSubmitEditing={() => logWater(parseFloat(waterCustom))}
                />
                {/* Quick picks inside modal */}
                <View style={s.waterPresets}>
                  {WATER_PRESETS.map(({ label, ml }) => (
                    <TouchableOpacity key={label} style={s.waterPresetBtn} onPress={() => { setWaterCustom(String(ml)); }}>
                      <Text style={s.waterPresetLabel}>{label}</Text>
                      <Text style={s.waterPresetMl}>{ml}ml</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {waterErr ? <Text style={s.waterErrText}>{waterErr}</Text> : null}
                <TouchableOpacity
                  style={[s.modalSaveBtn, waterSaving && { opacity: 0.6 }]}
                  onPress={() => logWater(parseFloat(waterCustom))}
                  disabled={waterSaving}
                >
                  {waterSaving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.modalSaveBtnText}>Log</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={s.modalCancelBtn} onPress={() => setWaterModalOpen(false)}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ── Today's Macros ── */}
        <TourTarget tourKey="food_macros">
          <View style={s.card}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
              <View>
                <Text style={s.cardTitle}>Today's Macros</Text>
                <Text style={s.chartSub}>Intake vs daily goal</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setGoalDraft({ protein: String(macroGoals.protein), carbs: String(macroGoals.carbs), fat: String(macroGoals.fat) });
                  setGoalErr("");
                  setGoalEditOpen(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {macroBars.map(({ label, value, goal, unit, color }) => {
              const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
              const over = goal > 0 && value > goal;
              const isCalories = label === "Calories";
              return (
                <View key={label} style={[s.macroRow, isCalories && { marginBottom: 4 }]}>
                  <View style={s.macroLabelRow}>
                    <View style={s.macroLabelLeft}>
                      <View style={[s.macroColorDot, isCalories && { width: 10, height: 10, borderRadius: 5 }, { backgroundColor: color }]} />
                      <Text style={[s.macroLabel, isCalories && s.macroLabelCalories]}>{label}</Text>
                    </View>
                    <Text style={[s.macroValue, isCalories && s.macroValueCalories, over && { color: colors.error }]}>
                      {value} / {goal} {unit}{over ? " ▲" : ""}
                    </Text>
                  </View>
                  <View style={[s.macroBarTrack, isCalories && { height: 10 }]}>
                    {pct > 0 && (
                      <View style={[s.macroBarFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: over ? colors.error : color }]} />
                    )}
                  </View>
                </View>
              );
            })}
            {logs.length === 0 && !loading && (
              <Text style={[s.emptySub, { textAlign: "center", marginTop: 4 }]}>
                Log food above to start tracking your macros
              </Text>
            )}
          </View>
        </TourTarget>

        {/* ── Micronutrients toggle ── */}
        <TouchableOpacity style={s.microToggleBtn} onPress={toggleMicros}>
          <Ionicons name="flask-outline" size={16} color={colors.primary} />
          <Text style={[s.microToggleBtnText, { color: colors.primary }]}>
            {showMicros ? "Hide Micronutrients" : "Show Micronutrients"}
          </Text>
          <Ionicons name={showMicros ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
        </TouchableOpacity>

        {showMicros && (
          <View style={s.card}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={s.cardTitle}>Today's Micronutrients</Text>
              <TouchableOpacity
                onPress={() => {
                  const draft = {};
                  MICRO_META.forEach(({ key, rdi }) => { draft[key] = String(effectiveRdi(key, rdi)); });
                  setMicroRdiDraft(draft);
                  setMicroEditOpen(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {!hasMicroData && (
              <Text style={[s.chartSub, { marginBottom: 2 }]}>No food logged today — showing daily targets</Text>
            )}
            {MICRO_META.map(({ key, label, unit, rdi, color }) => {
              const rdiVal = effectiveRdi(key, rdi);
              const value  = microTotals[key] || 0;
              const pct    = rdiVal > 0 ? Math.min(value / rdiVal, 1) : 0;
              const over   = value > rdiVal;
              return (
                <View key={key} style={s.macroRow}>
                  <View style={s.macroLabelRow}>
                    <View style={s.macroLabelLeft}>
                      <View style={[s.macroColorDot, { backgroundColor: color }]} />
                      <Text style={s.macroLabel}>{label}</Text>
                    </View>
                    <Text style={[s.macroValue, over && { color: colors.error }]}>
                      {value} / {rdiVal} {unit}{over ? " ▲" : ""}
                    </Text>
                  </View>
                  <View style={s.macroBarTrack}>
                    <View style={[s.macroBarFill, {
                      width: pct > 0 ? `${Math.round(pct * 100)}%` : "0%",
                      backgroundColor: over ? colors.error : color,
                    }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <TourTarget tourKey="food_recipes">
          <TouchableOpacity style={s.secondaryBtn} onPress={() => navigation.navigate("FindRecipes")}>
            <Ionicons name="book-outline" size={18} color={colors.primary} />
            <Text style={s.secondaryBtnText}>Find Recipes</Text>
          </TouchableOpacity>
        </TourTarget>
      </ScrollView>

      {/* ── Macro / Calorie Goal Edit Modal ─────────────────────────────── */}
      <Modal visible={goalEditOpen} transparent animationType="fade" onRequestClose={() => setGoalEditOpen(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Edit Daily Goals</Text>

            {/* Calorie preview block — always visible, updates live */}
            {(() => {
              const p = toN(goalDraft.protein), c = toN(goalDraft.carbs), f = toN(goalDraft.fat);
              const cal = p && c && f ? Math.round(p * 4 + c * 4 + f * 9) : null;
              const col = colors.primary || "#0b84ff";
              return (
                <View style={s.calPreviewBlock}>
                  <Text style={s.calPreviewLabel}>DAILY CALORIE GOAL</Text>
                  <Text style={[s.calPreviewNum, { color: cal ? col : colors.textLight }]}>
                    {cal ?? "—"}
                  </Text>
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

            {goalErr ? <Text style={s.waterErrText}>{goalErr}</Text> : null}
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

      {/* ── Water Goal Edit Modal ────────────────────────────────────────── */}
      <Modal visible={waterGoalEditOpen} transparent animationType="fade" onRequestClose={() => setWaterGoalEditOpen(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Daily Water Goal</Text>
            <Text style={s.modalSub}>Set your target in millilitres (500 – 8000 ml)</Text>
            <TextInput
              style={s.modalInput}
              keyboardType="numeric"
              placeholder="e.g. 2500"
              placeholderTextColor={colors.textLight}
              value={waterGoalDraft}
              onChangeText={setWaterGoalDraft}
              autoFocus
            />
            <View style={s.waterPresets}>
              {[2000, 2500, 3000, 3500].map((ml) => (
                <TouchableOpacity key={ml} style={s.waterPresetBtn} onPress={() => setWaterGoalDraft(String(ml))}>
                  <Text style={s.waterPresetLabel}>{ml}</Text>
                  <Text style={s.waterPresetMl}>ml</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.modalSaveBtn} onPress={saveWaterGoal}>
              <Text style={s.modalSaveBtnText}>Save Goal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalCancelBtn} onPress={() => setWaterGoalEditOpen(false)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Micro RDI Edit Modal ─────────────────────────────────────────── */}
      <Modal visible={microEditOpen} transparent animationType="slide" onRequestClose={() => setMicroEditOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[s.modalOverlay, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={[s.modalSheet, { maxHeight: "90%" }]}>
              <Text style={s.modalTitle}>Edit Micronutrient Targets</Text>
              <Text style={s.modalSub}>Customise your daily intake targets</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                {MICRO_META.map(({ key, label, unit, rdi, color }) => (
                  <View key={key} style={s.microEditRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                      <Text style={[s.microEditLabel, { color }]}>{label} ({unit})</Text>
                    </View>
                    <TextInput
                      style={[s.microEditInput, { borderColor: color + "88" }]}
                      keyboardType="decimal-pad"
                      placeholder={String(rdi)}
                      placeholderTextColor={colors.textLight}
                      value={microRdiDraft[key] ?? ""}
                      onChangeText={(v) => setMicroRdiDraft((prev) => ({ ...prev, [key]: v }))}
                    />
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity style={[s.modalSaveBtn, { marginTop: spacing.md }]} onPress={saveMicroRdis}>
                <Text style={s.modalSaveBtnText}>Save Targets</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setMicroEditOpen(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    primaryBtn: {
      backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 14,
      alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    primaryBtnText: { color: "#fff", fontSize: font.lg, fontWeight: font.semiBold },
    secondaryBtn: {
      borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.lg,
      paddingVertical: 13, alignItems: "center", flexDirection: "row",
      justifyContent: "center", gap: 8,
    },
    secondaryBtnText: { color: colors.primary, fontSize: font.base, fontWeight: font.semiBold },
    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    chartSub: { fontSize: font.sm, color: colors.textSecondary },

    // Macro/micro bars
    macroRow: { gap: 4 },
    macroLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    macroLabelLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    macroColorDot: { width: 8, height: 8, borderRadius: 4 },
    macroLabel: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.text },
    macroLabelCalories: { fontSize: font.base, fontWeight: "800" },
    macroValue: { fontSize: 11, color: colors.textSecondary },
    macroValueCalories: { fontSize: font.sm, fontWeight: "700" },
    macroBarTrack: {
      height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden",
    },
    macroBarFill: { height: "100%", borderRadius: 4 },

    // Food log table
    tableHead: {
      flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border,
      paddingBottom: spacing.sm, marginBottom: 2,
    },
    th: { fontSize: font.sm, fontWeight: font.bold, color: colors.textSecondary },
    tableRow: {
      flexDirection: "row", alignItems: "center", paddingVertical: 9,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    expandIcon: { width: 20, alignItems: "center" },
    td: { fontSize: font.sm, color: colors.text },
    tdBold: { fontSize: font.sm, color: colors.primary, fontWeight: font.semiBold },
    totalRow: {
      flexDirection: "row", justifyContent: "space-between", paddingTop: spacing.sm, marginTop: 2,
    },
    totalLabel: { fontSize: font.sm, fontWeight: font.bold, color: colors.textSecondary },
    totalValue: { fontSize: font.sm, fontWeight: font.bold, color: colors.primary },

    // Micro chips inside expanded food row
    microChips: {
      flexDirection: "row", flexWrap: "wrap", gap: 5,
      paddingVertical: spacing.sm, paddingLeft: 4,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    microChip: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: radius.full,
    },
    microChipDot: { width: 6, height: 6, borderRadius: 3 },
    microChipText: { fontSize: 11, fontWeight: "600" },
    microChipVal: { fontSize: 11, fontWeight: "700" },

    emptyState: { alignItems: "center", paddingVertical: spacing.xl, gap: 6 },
    empty: { color: colors.textSecondary, fontSize: font.sm, textAlign: "center" },
    emptySub: { color: colors.textLight, fontSize: font.sm },
    microToggleBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      paddingVertical: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primary,
    },
    microToggleBtnText: { fontSize: font.sm, fontWeight: font.semiBold },

    // Water widget
    waterStatRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    waterStatLabel: { fontSize: font.sm, color: colors.textSecondary },
    waterStatVal: { fontSize: font.sm, fontWeight: "700", color: colors.text },
    waterLogBtn: {
      backgroundColor: "#0ea5e9", borderRadius: radius.md, paddingVertical: 10,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4,
    },
    waterLogBtnText: { color: "#fff", fontSize: font.sm, fontWeight: font.semiBold },
    waterPresets: { flexDirection: "row", gap: spacing.sm },
    waterPresetBtn: {
      flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.md,
      backgroundColor: "#0ea5e920", borderWidth: 1, borderColor: "#0ea5e940",
    },
    waterPresetLabel: { fontSize: 10, fontWeight: "700", color: "#0ea5e9" },
    waterPresetMl: { fontSize: 10, color: colors.textSecondary },
    waterErrText: { color: colors.error, fontSize: font.sm, textAlign: "center" },

    // Water modal
    modalOverlay: {
      flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: spacing.xl, gap: spacing.md,
    },
    modalTitle: { fontSize: font.xl, fontWeight: font.bold, color: colors.text, textAlign: "center" },
    modalSub: { fontSize: font.sm, color: colors.textSecondary, textAlign: "center" },
    modalInput: {
      backgroundColor: colors.background, borderRadius: radius.md,
      paddingHorizontal: spacing.lg, paddingVertical: 14,
      fontSize: font.lg, color: colors.text, textAlign: "center",
      borderWidth: 1.5, borderColor: colors.border,
    },
    modalSaveBtn: {
      backgroundColor: "#0ea5e9", borderRadius: radius.lg, paddingVertical: 15,
      alignItems: "center", justifyContent: "center",
    },
    modalSaveBtnText: { color: "#fff", fontSize: font.lg, fontWeight: font.bold },
    modalCancelBtn: { alignItems: "center", paddingVertical: 10 },
    modalCancelText: { fontSize: font.base, color: colors.textSecondary },
    modalFieldLabel: { fontSize: font.sm, fontWeight: "600", color: colors.textSecondary, marginBottom: 4 },

    // Calorie preview block inside macro goal edit modal
    calPreviewBlock: {
      backgroundColor: (colors.primary || "#0b84ff") + "12",
      borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: spacing.lg,
      alignItems: "center", gap: 2,
      borderWidth: 1, borderColor: (colors.primary || "#0b84ff") + "30",
    },
    calPreviewLabel: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, letterSpacing: 1 },
    calPreviewNum:   { fontSize: 44, fontWeight: "900", lineHeight: 50 },
    calPreviewUnit:  { fontSize: font.sm, fontWeight: "600", color: colors.textSecondary },

    // Micro RDI edit rows
    microEditRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    microEditLabel: { fontSize: font.sm, color: colors.text, fontWeight: "600", flex: 1 },
    microEditInput: {
      width: 90, backgroundColor: colors.background, borderRadius: radius.sm,
      paddingHorizontal: spacing.sm, paddingVertical: 6,
      fontSize: font.sm, color: colors.text, textAlign: "right",
      borderWidth: 1, borderColor: colors.border,
    },
  });
}
