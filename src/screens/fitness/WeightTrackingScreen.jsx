import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_ICONS, EXERCISES } from "../../data/exercises";
import { getCustomPlans, saveCustomPlan, getPlanByIdAsync } from "../../data/workoutPlans";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

const exerciseDefaultsKey = (uid) => uid ? `sff_exercise_defaults_${uid}` : "sff_exercise_defaults";
const localActiveKey = (uid) => uid ? `sff_active_local_plan_${uid}` : "sff_active_local_plan";

const SETS_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }));
const WEIGHT_OPTIONS = [
  { label: "—", value: "" },
  ...Array.from({ length: 20 }, (_, i) => { const v = 2.5 + i * 2.5; return { label: `${v} kg`, value: String(v) }; }),
  ...Array.from({ length: 10 }, (_, i) => { const v = 55 + i * 5; return { label: `${v} kg`, value: String(v) }; }),
  ...Array.from({ length: 10 }, (_, i) => { const v = 110 + i * 10; return { label: `${v} kg`, value: String(v) }; }),
];
const REPS_OPTIONS = Array.from({ length: 30 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }));

function getOptions(field) {
  if (field === "sets") return SETS_OPTIONS;
  if (field === "weight") return WEIGHT_OPTIONS;
  return REPS_OPTIONS;
}

function fieldLabel(field) {
  if (field === "sets") return "Sets";
  if (field === "weight") return "Weight (kg)";
  return "Reps";
}

export default function WeightTrackingScreen({ navigation }) {
  const { colors } = useTheme();
  const { auth } = useAuth();
  const userId = auth?.userId;

  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);
  const [pickerTemp, setPickerTemp] = useState("");

  const [filterCat, setFilterCat] = useState("All");
  const [splitOnly, setSplitOnly] = useState(false);
  const [splitExNames, setSplitExNames] = useState(new Set());

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      setLoading(true);

      const [defRaw, customPlans, logsRes] = await Promise.all([
        AsyncStorage.getItem(exerciseDefaultsKey(userId)).catch(() => null),
        getCustomPlans(userId).catch(() => []),
        apiClient.get(`/api/workout-logs/user/${userId}`).catch(() => ({ data: [] })),
      ]);

      const defaults = defRaw ? JSON.parse(defRaw) : {};
      const logs = Array.isArray(logsRes.data) ? logsRes.data : [];

      // Build name→category map: EXERCISES data first, then plan exercises as fallback
      const catMap = {};
      for (const ex of EXERCISES) catMap[ex.name] = ex.category;
      for (const plan of customPlans) {
        for (const session of plan.sessions || []) {
          for (const ex of session.exercises || []) {
            if (ex.name && ex.category && !catMap[ex.name]) catMap[ex.name] = ex.category;
          }
        }
      }

      // Collect exercise names from custom plans
      const planNames = new Set();
      for (const plan of customPlans) {
        for (const session of plan.sessions || []) {
          for (const ex of session.exercises || []) {
            if (ex.name) planNames.add(ex.name);
          }
        }
      }

      // Parse last-used values from workout logs (oldest→newest so newest wins)
      const logMap = {};
      const sortedLogs = [...logs].sort((a, b) => new Date(a.performedAt || 0) - new Date(b.performedAt || 0));
      for (const log of sortedLogs) {
        if (!log.detailsJson) continue;
        try {
          const details = JSON.parse(log.detailsJson);
          for (const ex of details.exercises || []) {
            if (!ex.name) continue;
            const sets = Array.isArray(ex.sets) ? ex.sets : [];
            const doneSets = sets.filter((s) => s.weight || s.reps);
            if (!doneSets.length) continue;
            const last = doneSets[doneSets.length - 1];
            logMap[ex.name] = {
              weight: last.weight || "",
              reps: last.reps || "",
              sets: String(doneSets.length),
            };
          }
        } catch {}
      }

      // Load current active split exercise names
      const activeId = await AsyncStorage.getItem(localActiveKey(userId)).catch(() => "");
      const splitNames = new Set();
      if (activeId) {
        const activePlan = await getPlanByIdAsync(activeId, userId).catch(() => null);
        for (const session of activePlan?.sessions || []) {
          for (const ex of session.exercises || []) {
            if (ex.name) splitNames.add(ex.name);
          }
        }
      }
      setSplitExNames(splitNames);

      // Union: defaults + log keys + plan exercise names
      const allNames = new Set([...Object.keys(defaults), ...Object.keys(logMap), ...planNames]);
      const list = [];
      for (const name of allNames) {
        const def = defaults[name];
        const log = logMap[name];
        list.push({
          name,
          category: catMap[name] || "",
          sets: def?.sets ?? log?.sets ?? "3",
          weight: def?.weight ?? log?.weight ?? "",
          reps: def?.reps ?? log?.reps ?? "",
          isManual: !!def,
        });
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      setExercises(list);
    } catch {
      setExercises([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      if (filterCat !== "All" && ex.category !== filterCat) return false;
      if (splitOnly && !splitExNames.has(ex.name)) return false;
      return true;
    });
  }, [exercises, filterCat, splitOnly, splitExNames]);

  async function applyChange(name, field, value) {
    setSaving(true);
    try {
      const raw = await AsyncStorage.getItem(exerciseDefaultsKey(userId));
      const defs = raw ? JSON.parse(raw) : {};
      defs[name] = { sets: "3", weight: "", reps: "", ...defs[name], [field]: value };
      await AsyncStorage.setItem(exerciseDefaultsKey(userId), JSON.stringify(defs));

      // Mirror reps and sets changes into matching custom plan exercises
      if (field === "reps" || field === "sets") {
        const plans = await getCustomPlans(userId);
        for (const plan of plans) {
          let changed = false;
          const sessions = plan.sessions.map((s) => ({
            ...s,
            exercises: s.exercises.map((ex) => {
              if (ex.name !== name) return ex;
              changed = true;
              return {
                ...ex,
                ...(field === "reps" ? { reps: value } : {}),
                ...(field === "sets" ? { sets: Number(value) } : {}),
              };
            }),
          }));
          if (changed) await saveCustomPlan({ ...plan, sessions }, userId);
        }
      }

      setExercises((prev) =>
        prev.map((ex) => ex.name === name ? { ...ex, [field]: value, isManual: true } : ex)
      );
    } catch {}
    setSaving(false);
  }

  function openPicker(name, field, currentValue) {
    setPickerTarget({ name, field });
    const fallback = field === "sets" ? "3" : field === "reps" ? "8" : "";
    setPickerTemp(currentValue || fallback);
    setPickerVisible(true);
  }

  function confirmPicker() {
    if (pickerTarget) applyChange(pickerTarget.name, pickerTarget.field, pickerTemp);
    setPickerVisible(false);
  }

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Weight Tracking</Text>
        <View style={s.headerBtn} />
      </View>

      {/* Category filter row */}
      <View style={s.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {["All", ...CATEGORIES].map((cat) => {
            const active = filterCat === cat;
            const catColor = CATEGORY_COLORS[cat] || colors.primary;
            return (
              <TouchableOpacity
                key={cat}
                style={[s.filterChip, active && { backgroundColor: catColor, borderColor: catColor }]}
                onPress={() => setFilterCat(active && cat !== "All" ? "All" : cat)}
              >
                {cat !== "All" && (
                  <MaterialCommunityIcons
                    name={CATEGORY_ICONS[cat]}
                    size={11}
                    color={active ? "#fff" : catColor}
                    style={{ marginRight: 3 }}
                  />
                )}
                <Text style={[s.filterChipText, active && { color: "#fff" }]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity
          style={[s.splitChip, splitOnly && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => setSplitOnly((v) => !v)}
        >
          <Ionicons name="barbell-outline" size={12} color={splitOnly ? "#fff" : colors.primary} style={{ marginRight: 3 }} />
          <Text style={[s.filterChipText, splitOnly && { color: "#fff" }]}>Split only</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
        ) : exercises.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="barbell-outline" size={48} color={colors.textSecondary} />
            <Text style={s.emptyTitle}>No exercises found</Text>
            <Text style={s.emptySub}>Create a custom plan or complete a workout to populate this list. Defaults you set here will pre-fill in your next workout.</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="search-outline" size={40} color={colors.textSecondary} />
            <Text style={s.emptyTitle}>No matches</Text>
            <Text style={s.emptySub}>No exercises match the current filters. Try changing the category or toggling Split only off.</Text>
          </View>
        ) : (
          <View style={s.card}>
            <Text style={s.cardTitle}>Exercise Defaults</Text>
            <Text style={s.cardSub}>Tap any value to update. Changes apply the next time you start a workout and update your custom plans.</Text>
            <View style={s.tableHead}>
              <Text style={[s.th, { flex: 1 }]}>Exercise</Text>
              <Text style={[s.th, { width: 46, textAlign: "center" }]}>Sets</Text>
              <Text style={[s.th, { width: 80, textAlign: "center" }]}>Weight</Text>
              <Text style={[s.th, { width: 46, textAlign: "center" }]}>Reps</Text>
            </View>
            {filtered.map((ex) => (
              <View key={ex.name} style={s.row}>
                <View style={{ flex: 1, paddingRight: 4 }}>
                  <Text style={s.exerciseName} numberOfLines={2}>{ex.name}</Text>
                  {ex.category ? (
                    <Text style={[s.exerciseCat, { color: CATEGORY_COLORS[ex.category] || colors.textSecondary }]}>
                      {ex.category}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity style={[s.valueBtn, { width: 46 }]} onPress={() => openPicker(ex.name, "sets", ex.sets)}>
                  <Text style={s.valueBtnText}>{ex.sets || "3"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.valueBtn, s.valueBtnWeight, { width: 80 }]} onPress={() => openPicker(ex.name, "weight", ex.weight)}>
                  <Text style={[s.valueBtnText, !ex.weight && s.valuePlaceholder]}>
                    {ex.weight ? `${ex.weight} kg` : "—"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.valueBtn, { width: 46 }]} onPress={() => openPicker(ex.name, "reps", ex.reps)}>
                  <Text style={[s.valueBtnText, !ex.reps && s.valuePlaceholder]}>
                    {ex.reps || "—"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={s.pickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPickerVisible(false)} />
          <View style={s.pickerSheet}>
            <View style={s.pickerToolbar}>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={s.pickerCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.pickerTitle}>{pickerTarget ? fieldLabel(pickerTarget.field) : ""}</Text>
              <TouchableOpacity onPress={confirmPicker} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={s.pickerDone}>Done</Text>}
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={pickerTemp}
              onValueChange={(v) => setPickerTemp(v)}
              style={[s.pickerWheel, { backgroundColor: colors.surface }]}
              itemStyle={{ color: colors.text, backgroundColor: colors.surface }}
            >
              {getOptions(pickerTarget?.field).map((opt) => (
                <Picker.Item key={opt.value} label={opt.label} value={opt.value} color={colors.text} />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerBtn: { width: 40 },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    filterContainer: {
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
      paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.xs,
    },
    filterRow: { paddingHorizontal: spacing.md, gap: spacing.sm, alignItems: "center" },
    filterChip: {
      flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingVertical: 5,
      borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    splitChip: {
      flexDirection: "row", alignItems: "center", marginHorizontal: spacing.md,
      paddingHorizontal: spacing.sm, paddingVertical: 5,
      borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface,
      alignSelf: "flex-start",
    },
    filterChipText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xs },
    emptyCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl,
      alignItems: "center", gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    emptyTitle: { fontSize: font.xl, fontWeight: font.bold, color: colors.text },
    emptySub: { fontSize: font.sm, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    cardSub: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 18 },
    tableHead: {
      flexDirection: "row", alignItems: "center", paddingBottom: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    th: { fontSize: font.sm, fontWeight: font.bold, color: colors.textSecondary },
    row: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    exerciseName: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.text },
    exerciseCat: { fontSize: 10, marginTop: 1 },
    valueBtn: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
      paddingVertical: 6, alignItems: "center", backgroundColor: colors.background,
    },
    valueBtnWeight: { backgroundColor: colors.insightBg, borderColor: colors.insightBorder },
    valueBtnText: { fontSize: font.sm, color: colors.text, fontWeight: font.semiBold },
    valuePlaceholder: { color: colors.textSecondary },
    pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: 32 },
    pickerToolbar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    pickerTitle: { fontSize: font.base, fontWeight: font.semiBold, color: colors.text },
    pickerCancel: { fontSize: font.base, color: colors.textSecondary },
    pickerDone: { fontSize: font.base, fontWeight: font.bold, color: colors.primary },
    pickerWheel: { height: 200 },
  });
}
