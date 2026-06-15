import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Modal, PanResponder, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import { useAuth } from "../../auth/useAuth";
import { saveCustomPlan } from "../../data/workoutPlans";
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_ICONS, EXERCISES, searchExercises } from "../../data/exercises";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const GOALS  = ["Strength", "Muscle Gain", "Fat Loss", "General Fitness"];
const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const SETS_OPTIONS = Array.from({ length: 20 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }));
const REPS_OPTIONS = Array.from({ length: 50 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }));
const WEIGHT_OPTIONS = [
  { label: "—", value: "" },
  ...[1,2,2.5,5,7.5,10,12.5,15,17.5,20,22.5,25,27.5,30,32.5,35,37.5,40,42.5,45,47.5,50,52.5,55,57.5,60,65,70,75,80,85,90,95,100,110,120,130,140,150,160,180,200].map(v => ({ label: `${v} kg`, value: String(v) })),
];
const DURATION_OPTS = [
  { label: "—", value: "" },
  ...[5,10,15,20,25,30,35,40,45,50,55,60,75,90,105,120].map(v => ({ label: `${v} min`, value: String(v) })),
];

export default function CustomPlanBuilderScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { auth } = useAuth();
  const userId = auth?.userId;
  const editPlan = route?.params?.editPlan ?? null;

  // Plan meta
  const [planName,    setPlanName]    = useState(editPlan?.name ?? "");
  const [daysPerWeek, setDaysPerWeek] = useState(editPlan?.daysPerWeek ?? 1);
  const [level,  setLevel]  = useState(editPlan?.level ?? "Intermediate");
  const [goal,   setGoal]   = useState(editPlan?.goal ?? "General Fitness");
  const [desc,   setDesc]   = useState(editPlan?.description ?? "");

  // Sessions
  const [sessions, setSessions] = useState(
    editPlan?.sessions?.map(s => ({ ...s, weekdays: s.weekdays ?? [] })) ??
    [{ title: "Session 1", exercises: [], weekdays: [] }]
  );

  // Exercise picker modal
  const [pickerOpen, setPickerOpen]     = useState(false);
  const [pickerSessIdx, setPickerSessIdx] = useState(0);
  const [pickerQ, setPickerQ]           = useState("");
  const [pickerCat, setPickerCat]       = useState("All");

  // Saving
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // Scroll wheel picker
  const [wheel, setWheel] = useState({ open: false, field: "", sessIdx: 0, exIdx: 0, temp: "", options: [], label: "" });

  function openWheel(si, ei, field, currentVal, options, label) {
    setWheel({ open: true, field, sessIdx: si, exIdx: ei, temp: String(currentVal ?? ""), options, label });
  }

  function confirmWheel() {
    const { field, sessIdx, exIdx, temp } = wheel;
    updateExerciseField(sessIdx, exIdx, field, field === "sets" ? (Number(temp) || 1) : temp);
    setWheel(w => ({ ...w, open: false }));
  }

  const pickerPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, { dy }) => dy > 5,
    onPanResponderRelease: (_, { dy }) => { if (dy > 40) setPickerOpen(false); },
  })).current;

  const filteredExercises = useMemo(() => {
    const base = pickerQ.trim() ? searchExercises(pickerQ.trim()) : EXERCISES;
    return pickerCat === "All" ? base : base.filter(e => e.category === pickerCat);
  }, [pickerQ, pickerCat]);

  function adjustDays(delta) {
    const next = Math.max(1, Math.min(7, daysPerWeek + delta));
    setDaysPerWeek(next);
    setSessions(prev => {
      if (next > prev.length) {
        const added = [];
        for (let i = prev.length; i < next; i++) added.push({ title: `Session ${i + 1}`, exercises: [], weekdays: [] });
        return [...prev, ...added];
      }
      return prev.slice(0, next);
    });
  }

  function updateSessionTitle(idx, title) {
    setSessions(prev => prev.map((s, i) => i === idx ? { ...s, title } : s));
  }

  function toggleSessionDay(sessIdx, dayVal) {
    setSessions(prev => prev.map((s, i) => {
      if (i !== sessIdx) return s;
      const days = s.weekdays || [];
      const has = days.includes(dayVal);
      return { ...s, weekdays: has ? days.filter(d => d !== dayVal) : [...days, dayVal].sort((a, b) => a - b) };
    }));
  }

  function openExercisePicker(sessIdx) {
    setPickerSessIdx(sessIdx);
    setPickerQ("");
    setPickerCat("All");
    setPickerOpen(true);
  }

  function addExercise(exercise) {
    setSessions(prev => prev.map((s, i) => {
      if (i !== pickerSessIdx) return s;
      if (s.exercises.find(e => e.exerciseId === exercise.id)) return s;
      return {
        ...s,
        exercises: [...s.exercises, {
          exerciseId: exercise.id,
          name: exercise.name,
          category: exercise.category,
          equipment: exercise.equipment,
          notes: exercise.instructions[0] || "",
          sets: 3,
          reps: "10",
          weight: "",
        }],
      };
    }));
  }

  function removeExercise(sessIdx, exIdx) {
    setSessions(prev => prev.map((s, i) => i !== sessIdx ? s : {
      ...s, exercises: s.exercises.filter((_, j) => j !== exIdx),
    }));
  }

  function moveExercise(sessIdx, exIdx, dir) {
    setSessions(prev => prev.map((s, i) => {
      if (i !== sessIdx) return s;
      const exs = [...s.exercises];
      const swap = exIdx + dir;
      if (swap < 0 || swap >= exs.length) return s;
      [exs[exIdx], exs[swap]] = [exs[swap], exs[exIdx]];
      return { ...s, exercises: exs };
    }));
  }

  function updateExerciseField(sessIdx, exIdx, field, value) {
    setSessions(prev => prev.map((s, i) => i !== sessIdx ? s : {
      ...s, exercises: s.exercises.map((e, j) => j !== exIdx ? e : { ...e, [field]: value }),
    }));
  }

  async function save() {
    if (!planName.trim()) { setSaveErr("Give your plan a name."); return; }
    if (sessions.every(s => s.exercises.length === 0)) { setSaveErr("Add at least one exercise to a session."); return; }
    setSaving(true); setSaveErr("");
    try {
      const plan = {
        id: editPlan?.id ?? `custom_${Date.now()}`,
        name: planName.trim(),
        level,
        goal,
        daysPerWeek,
        description: desc.trim() || `Custom ${level.toLowerCase()} ${goal.toLowerCase()} plan.`,
        sessions: sessions.filter(s => s.exercises.length > 0),
      };
      await saveCustomPlan(plan, userId);
      navigation.dispatch(CommonActions.reset({
        index: 1,
        routes: [{ name: "FitnessMain" }, { name: "WorkoutPlans", params: { initialTab: "myplans" } }],
      }));
    } catch {
      setSaveErr("Could not save plan. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Create Plan</Text>
        <TouchableOpacity onPress={save} style={s.saveBtn} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.primary} size="small" /> : (
            <Text style={[s.saveBtnText, { color: colors.primary }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {/* Plan name */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Plan Details</Text>
          <TextInput
            style={s.input}
            value={planName}
            onChangeText={setPlanName}
            placeholder="Plan name…"
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            style={[s.input, { minHeight: 60, textAlignVertical: "top" }]}
            value={desc}
            onChangeText={setDesc}
            placeholder="Short description (optional)"
            placeholderTextColor={colors.textSecondary}
            multiline
          />

          {/* Days per week */}
          <View style={s.daysRow}>
            <Text style={s.fieldLabel}>Days per week</Text>
            <View style={s.dayStepper}>
              <TouchableOpacity onPress={() => adjustDays(-1)} style={s.stepBtn}>
                <Ionicons name="remove" size={18} color={colors.primary} />
              </TouchableOpacity>
              <Text style={s.dayValue}>{daysPerWeek}</Text>
              <TouchableOpacity onPress={() => adjustDays(1)} style={s.stepBtn}>
                <Ionicons name="add" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Level */}
          <Text style={s.fieldLabel}>Level</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {LEVELS.map(x => (
              <TouchableOpacity key={x} style={[s.chip, level === x && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setLevel(x)}>
                <Text style={[s.chipText, level === x && { color: "#fff" }]}>{x}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Goal */}
          <Text style={s.fieldLabel}>Goal</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {GOALS.map(x => (
              <TouchableOpacity key={x} style={[s.chip, goal === x && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setGoal(x)}>
                <Text style={[s.chipText, goal === x && { color: "#fff" }]}>{x}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Sessions */}
        {sessions.map((sess, si) => (
          <View key={si} style={s.card}>
            <View style={s.sessHeaderRow}>
              <TextInput
                style={s.sessNameInput}
                value={sess.title}
                onChangeText={(t) => updateSessionTitle(si, t)}
                placeholder={`Session ${si + 1}`}
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity style={s.addExBtn} onPress={() => openExercisePicker(si)}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={s.addExBtnText}>Add Exercise</Text>
              </TouchableOpacity>
            </View>

            <View>
              <Text style={s.fieldLabel}>Training Days</Text>
              <View style={s.dayPickerRow}>
                {DAYS.map((d, i) => {
                  const active = (sess.weekdays || []).includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[s.dayBtn, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => toggleSessionDay(si, i)}
                    >
                      <Text style={[s.dayBtnText, active && { color: "#fff" }]}>{d}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {sess.exercises.length === 0 ? (
              <Text style={s.emptySession}>No exercises yet — tap Add Exercise.</Text>
            ) : sess.exercises.map((ex, ei) => {
              const isCardio = ex.category === "Cardio";
              return (
                <View key={ei} style={s.exBlock}>
                  <View style={s.exNameRow}>
                    <View style={s.exReorderCol}>
                      <TouchableOpacity onPress={() => moveExercise(si, ei, -1)} disabled={ei === 0} hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}>
                        <Ionicons name="chevron-up" size={14} color={ei === 0 ? colors.border : colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => moveExercise(si, ei, 1)} disabled={ei === sess.exercises.length - 1} hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}>
                        <Ionicons name="chevron-down" size={14} color={ei === sess.exercises.length - 1 ? colors.border : colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <View style={[s.exDot, { backgroundColor: CATEGORY_COLORS[ex.category] || colors.primary }]} />
                    <Text style={s.exName}>{ex.name}</Text>
                    <TouchableOpacity onPress={() => removeExercise(si, ei)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={16} color={colors.error || "#ef4444"} />
                    </TouchableOpacity>
                  </View>
                  <View style={s.exFieldsRow}>
                    {isCardio ? (
                      <>
                        <View style={s.exField}>
                          <Text style={s.exFieldLabel}>Rounds</Text>
                          <TouchableOpacity style={s.exFieldBtn} onPress={() => openWheel(si, ei, "sets", ex.sets, SETS_OPTIONS, "Rounds")}>
                            <Text style={s.exFieldBtnValue}>{ex.sets || "1"}</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={s.exField}>
                          <Text style={s.exFieldLabel}>Duration (min)</Text>
                          <TouchableOpacity style={s.exFieldBtn} onPress={() => openWheel(si, ei, "reps", ex.reps, DURATION_OPTS, "Duration (min)")}>
                            <Text style={s.exFieldBtnValue}>{ex.reps || "—"}</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={s.exField}>
                          <Text style={s.exFieldLabel}>Sets</Text>
                          <TouchableOpacity style={s.exFieldBtn} onPress={() => openWheel(si, ei, "sets", ex.sets, SETS_OPTIONS, "Sets")}>
                            <Text style={s.exFieldBtnValue}>{ex.sets || "3"}</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={s.exField}>
                          <Text style={s.exFieldLabel}>Weight (kg)</Text>
                          <TouchableOpacity style={s.exFieldBtn} onPress={() => openWheel(si, ei, "weight", ex.weight, WEIGHT_OPTIONS, "Weight (kg)")}>
                            <Text style={s.exFieldBtnValue}>{ex.weight ? `${ex.weight} kg` : "—"}</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={s.exField}>
                          <Text style={s.exFieldLabel}>Reps</Text>
                          <TouchableOpacity style={s.exFieldBtn} onPress={() => openWheel(si, ei, "reps", ex.reps, REPS_OPTIONS, "Reps")}>
                            <Text style={s.exFieldBtnValue}>{ex.reps || "10"}</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {saveErr ? <Text style={s.errText}>{saveErr}</Text> : null}
      </ScrollView>

      {/* Scroll Wheel Picker Modal */}
      <Modal visible={wheel.open} transparent animationType="slide" onRequestClose={() => setWheel(w => ({ ...w, open: false }))}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} activeOpacity={1} onPress={() => setWheel(w => ({ ...w, open: false }))} />
        <View style={s.wheelSheet}>
          <View style={s.wheelHeader}>
            <TouchableOpacity onPress={() => setWheel(w => ({ ...w, open: false }))} style={s.wheelAction}>
              <Text style={s.wheelCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.wheelTitle}>{wheel.label}</Text>
            <TouchableOpacity onPress={confirmWheel} style={s.wheelAction}>
              <Text style={[s.wheelDone, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <Picker
            selectedValue={wheel.temp}
            onValueChange={(v) => setWheel(w => ({ ...w, temp: v }))}
            style={s.wheelPicker}
            itemStyle={{ color: colors.text }}
          >
            {wheel.options.map(o => (
              <Picker.Item key={o.value} label={o.label} value={o.value} color={colors.text} />
            ))}
          </Picker>
        </View>
      </Modal>

      {/* Exercise Picker Modal */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandleArea} {...pickerPan.panHandlers}>
              <View style={s.modalHandle} />
            </View>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Add to: {sessions[pickerSessIdx]?.title}</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)} style={s.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={s.pickerSearch}>
              <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
              <TextInput
                style={s.pickerSearchInput}
                value={pickerQ}
                onChangeText={setPickerQ}
                placeholder="Search exercises…"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={s.catRowWrap}>
              <FlatList
                horizontal
                data={["All", ...CATEGORIES]}
                keyExtractor={cat => cat}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.catRow}
                renderItem={({ item: cat }) => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.catChip, pickerCat === cat && { backgroundColor: (CATEGORY_COLORS[cat] || colors.primary), borderColor: (CATEGORY_COLORS[cat] || colors.primary) }]}
                    onPress={() => setPickerCat(prev => prev === cat ? "All" : cat)}
                  >
                    {cat !== "All" && (
                      <MaterialCommunityIcons name={CATEGORY_ICONS[cat]} size={11} color={pickerCat === cat ? "#fff" : (CATEGORY_COLORS[cat] || colors.textSecondary)} style={{ marginRight: 3 }} />
                    )}
                    <Text style={[s.catChipText, pickerCat === cat && { color: "#fff" }]}>{cat}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            <FlatList
              data={filteredExercises}
              keyExtractor={e => e.id}
              keyboardShouldPersistTaps="handled"
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
              renderItem={({ item }) => {
                const catColor = CATEGORY_COLORS[item.category] || colors.primary;
                const alreadyAdded = sessions[pickerSessIdx]?.exercises.some(e => e.exerciseId === item.id);
                return (
                  <TouchableOpacity
                    style={[s.exPickerRow, alreadyAdded && { opacity: 0.5 }]}
                    onPress={() => { if (!alreadyAdded) addExercise(item); }}
                    disabled={alreadyAdded}
                  >
                    <View style={[s.exPickerDot, { backgroundColor: catColor }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.exPickerName}>{item.name}</Text>
                      <Text style={s.exPickerMeta}>{item.equipment} · {item.primaryMuscles[0]}</Text>
                    </View>
                    <Ionicons name={alreadyAdded ? "checkmark-circle" : "add-circle-outline"} size={22} color={alreadyAdded ? "#22c55e" : catColor} />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={s.empty}>No exercises found.</Text>}
            />
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
    headerBtn: { width: 50 },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    saveBtn: { width: 50, alignItems: "flex-end", justifyContent: "center" },
    saveBtnText: { fontSize: font.base, fontWeight: font.bold },
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    input: {
      backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing.md,
      paddingVertical: 11, fontSize: font.base, color: colors.text, borderWidth: 1, borderColor: colors.border,
    },
    fieldLabel: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.textSecondary },
    daysRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    dayStepper: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
    dayValue: { fontSize: font.xl, fontWeight: font.bold, color: colors.text, minWidth: 24, textAlign: "center" },
    chipRow: { gap: spacing.sm },
    chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
    chipText: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.textSecondary },
    sessHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    sessNameInput: {
      flex: 1, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing.md,
      paddingVertical: 9, fontSize: font.base, fontWeight: font.semiBold, color: colors.text,
      borderWidth: 1, borderColor: colors.border,
    },
    addExBtn: {
      backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: spacing.md,
      flexDirection: "row", alignItems: "center", gap: 4,
    },
    addExBtnText: { color: "#fff", fontSize: font.sm, fontWeight: font.bold },
    emptySession: { fontSize: font.sm, color: colors.textSecondary, textAlign: "center", paddingVertical: spacing.sm },
    exBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 6 },
    exNameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    exReorderCol: { gap: 1, alignItems: "center", justifyContent: "center" },
    exDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    exName: { flex: 1, fontSize: font.sm, fontWeight: font.semiBold, color: colors.text },
    exFieldsRow: { flexDirection: "row", gap: spacing.sm, paddingLeft: 26 },
    exField: { flex: 1, gap: 3 },
    exFieldLabel: { fontSize: 10, fontWeight: font.semiBold, color: colors.textSecondary },
    exFieldBtn: {
      backgroundColor: colors.background, borderRadius: radius.sm,
      paddingVertical: 8, alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border,
    },
    exFieldBtnValue: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.text },
    // Wheel picker modal
    wheelSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    wheelHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    wheelTitle: { fontSize: font.base, fontWeight: font.bold, color: colors.text },
    wheelAction: { width: 64 },
    wheelCancel: { fontSize: font.sm, color: colors.textSecondary },
    wheelDone: { fontSize: font.sm, fontWeight: font.bold, textAlign: "right" },
    wheelPicker: { height: 216 },
    dayPickerRow: { flexDirection: "row", gap: 6, marginTop: 6 },
    dayBtn: {
      flex: 1, paddingVertical: 7, borderRadius: radius.sm, alignItems: "center",
      borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background,
    },
    dayBtnText: { fontSize: 11, fontWeight: "700", color: colors.textSecondary },
    errText: { color: colors.error || "#ef4444", textAlign: "center", fontSize: font.sm },
    // Exercise picker modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: {
      backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      height: "88%",
    },
    modalHandleArea: { alignItems: "center", justifyContent: "center", paddingVertical: 12 },
    modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
    modalHead: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: font.base, fontWeight: font.bold, color: colors.text, flex: 1 },
    closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    pickerSearch: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm, margin: spacing.md,
      backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 9,
      borderWidth: 1, borderColor: colors.border,
    },
    pickerSearchInput: { flex: 1, fontSize: font.sm, color: colors.text },
    catRowWrap: { height: 38, borderBottomWidth: 1, borderBottomColor: colors.border },
    catRow: { paddingHorizontal: spacing.md, paddingVertical: 6, gap: spacing.sm, alignItems: "center" },
    catChip: {
      flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    catChipText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
    exPickerRow: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md,
    },
    exPickerDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
    exPickerName: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.text },
    exPickerMeta: { fontSize: 11, color: colors.textSecondary },
    empty: { textAlign: "center", color: colors.textSecondary, fontSize: font.sm, marginTop: spacing.lg },
  });
}
