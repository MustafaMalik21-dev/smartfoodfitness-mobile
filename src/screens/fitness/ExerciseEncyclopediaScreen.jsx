import { useMemo, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { getCustomPlans, saveCustomPlan } from "../../data/workoutPlans";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  EXERCISES,
  searchExercises,
} from "../../data/exercises";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

const DIFF_COLORS = {
  Beginner: "#22c55e",
  Intermediate: "#f59e0b",
  Advanced: "#ef4444",
};

const ALL_FILTERS = ["All", ...CATEGORIES];

function DiffBadge({ level }) {
  const bg = DIFF_COLORS[level] || "#6b7280";
  return (
    <View style={[badgeBase.wrap, { backgroundColor: bg + "22" }]}>
      <Text style={[badgeBase.text, { color: bg }]}>{level}</Text>
    </View>
  );
}

const badgeBase = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: "flex-start" },
  text: { fontSize: 11, fontWeight: "600" },
});

function ExerciseCard({ exercise, onPress, colors }) {
  const catColor = CATEGORY_COLORS[exercise.category] || colors.primary;
  return (
    <TouchableOpacity
      onPress={() => onPress(exercise)}
      style={[cardBase.card, { backgroundColor: colors.surface }]}
      activeOpacity={0.75}
    >
      <View style={[cardBase.strip, { backgroundColor: catColor }]} />
      <View style={cardBase.body}>
        <View style={cardBase.iconRow}>
          <View style={[cardBase.iconWrap, { backgroundColor: catColor + "22" }]}>
            <MaterialCommunityIcons name={CATEGORY_ICONS[exercise.category] || "dumbbell"} size={18} color={catColor} />
          </View>
          <DiffBadge level={exercise.difficulty} />
        </View>
        <Text style={[cardBase.name, { color: colors.text }]} numberOfLines={2}>{exercise.name}</Text>
        <Text style={[cardBase.muscles, { color: colors.textSecondary }]} numberOfLines={1}>
          {exercise.primaryMuscles.join(", ")}
        </Text>
        <Text style={[cardBase.equip, { color: colors.textLight || colors.textSecondary }]}>{exercise.equipment}</Text>
      </View>
    </TouchableOpacity>
  );
}

const cardBase = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  strip: { height: 4, width: "100%" },
  body: { padding: spacing.md, gap: 6 },
  iconRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  name: { fontSize: font.sm, fontWeight: "700", lineHeight: 18 },
  muscles: { fontSize: 11, lineHeight: 16 },
  equip: { fontSize: 11 },
});

export default function ExerciseEncyclopediaScreen({ navigation }) {
  const { colors } = useTheme();
  const { auth } = useAuth();
  const userId = auth?.userId;
  const [category, setCategory] = useState("All");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);

  // Add-to-workout flow
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addExercise, setAddExercise] = useState(null); // exercise being added (separate from detail sheet)
  const [addPlans, setAddPlans] = useState([]);
  const [addPlan, setAddPlan] = useState(null);
  const [addSession, setAddSession] = useState(null);
  const [addPosition, setAddPosition] = useState(null); // null = end; number = insert after index
  const [addSaving, setAddSaving] = useState(false);
  const [addDone, setAddDone] = useState(false);

  const displayed = useMemo(() => {
    const base = q.trim() ? searchExercises(q.trim()) : EXERCISES;
    if (category === "All") return base;
    return base.filter((e) => e.category === category);
  }, [q, category]);

  async function openAddToWorkout(exercise) {
    setAddExercise(exercise);
    setSelected(null); // close detail sheet first so modals don't stack
    setAddDone(false); setAddPlan(null); setAddSession(null); setAddPosition(null);
    const custom = await getCustomPlans(userId).catch(() => []);
    setAddPlans(custom);
    setAddModalOpen(true);
  }

  async function confirmAddToWorkout() {
    if (!addPlan || !addSession || !addExercise) return;
    setAddSaving(true);
    try {
      // Load fresh copy of the plan, add exercise, save back
      const customs = await getCustomPlans(userId);
      const plan = customs.find((p) => p.id === addPlan.id);
      if (!plan) throw new Error("Plan not found");

      const newEx = {
        exerciseId: addExercise.id,
        name: addExercise.name,
        category: addExercise.category,
        equipment: addExercise.equipment || "",
        notes: (addExercise.instructions || [])[0] || "",
        sets: 3,
        reps: "10",
      };

      const updatedSessions = plan.sessions.map((s) => {
        if (s.title !== addSession.title) return s;
        const exs = [...s.exercises];
        if (addPosition === -1) exs.unshift(newEx);
        else if (addPosition !== null) exs.splice(addPosition + 1, 0, newEx);
        else exs.push(newEx);
        return { ...s, exercises: exs };
      });

      await saveCustomPlan({ ...plan, sessions: updatedSessions }, userId);
      setAddDone(true);
      setTimeout(() => { setAddModalOpen(false); setAddDone(false); setAddExercise(null); }, 1500);
    } catch {
    } finally {
      setAddSaving(false);
    }
  }

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Exercise Encyclopedia</Text>
        <View style={s.headerBtn} />
      </View>

      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <TextInput
          style={s.searchInput}
          value={q}
          onChangeText={setQ}
          placeholder="Search exercises, muscles…"
          placeholderTextColor={colors.textSecondary}
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={() => setQ("")}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {ALL_FILTERS.map((cat) => {
            const on = category === cat;
            const catColor = cat === "All" ? colors.primary : CATEGORY_COLORS[cat];
            return (
              <TouchableOpacity
                key={cat}
                style={[s.filterChip, on && { backgroundColor: catColor, borderColor: catColor }]}
                onPress={() => setCategory(cat)}
              >
                {cat !== "All" && (
                  <MaterialCommunityIcons
                    name={CATEGORY_ICONS[cat]}
                    size={13}
                    color={on ? "#fff" : catColor}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text style={[s.filterText, on && s.filterTextOn]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <Text style={s.countLabel}>{displayed.length} exercise{displayed.length !== 1 ? "s" : ""}</Text>

      <FlatList
        data={displayed}
        keyExtractor={(e) => e.id}
        numColumns={2}
        columnWrapperStyle={s.row}
        contentContainerStyle={s.grid}
        renderItem={({ item }) => (
          <ExerciseCard exercise={item} onPress={setSelected} colors={colors} />
        )}
        ListEmptyComponent={
          <Text style={s.empty}>No exercises match your search.</Text>
        }
      />

      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            {selected && <DetailContent
              exercise={selected}
              colors={colors}
              s={s}
              onAddToWorkout={() => openAddToWorkout(selected)}
              onClose={() => setSelected(null)}
            />}
          </View>
        </View>
      </Modal>

      {/* Add to Workout picker */}
      <Modal
        visible={addModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => { setAddModalOpen(false); setAddExercise(null); }}
      >
        <View style={s.overlay}>
          <View style={[s.sheet, { maxHeight: "80%" }]}>
            <View style={s.sheetStrip} />
            <View style={s.sheetHead}>
              <View>
                <Text style={s.sheetTitle}>Add to Workout</Text>
                <Text style={s.sheetEquip}>{addExercise?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => { setAddModalOpen(false); setAddExercise(null); }} style={s.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.sheetScroll} contentContainerStyle={{ padding: spacing.lg }}>
              {/* Step 1: Pick a custom plan */}
              <View style={s.stepHeader}>
                <View style={[s.stepBubble, { backgroundColor: colors.primary }]}><Text style={s.stepBubbleText}>1</Text></View>
                <Text style={[s.stepLabel, { color: colors.text }]}>Choose your plan</Text>
              </View>
              {addPlans.length === 0 && (
                <Text style={{ fontSize: font.sm, color: colors.textSecondary, fontStyle: "italic", marginBottom: spacing.sm }}>
                  No custom plans found. Create one in the Fitness tab first.
                </Text>
              )}
              {addPlans.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.pickerRow, addPlan?.id === p.id && { backgroundColor: colors.primary + "18", borderColor: colors.primary }]}
                  onPress={() => { setAddPlan(p); setAddSession(null); setAddPosition(null); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.pickerRowText, { color: colors.text }]}>{p.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>{p.level} · {p.daysPerWeek} days/week</Text>
                  </View>
                  {addPlan?.id === p.id && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}

              {/* Step 2: Pick a session */}
              {addPlan && (
                <>
                  <View style={[s.stepHeader, { marginTop: spacing.lg }]}>
                    <View style={[s.stepBubble, { backgroundColor: colors.primary }]}><Text style={s.stepBubbleText}>2</Text></View>
                    <Text style={[s.stepLabel, { color: colors.text }]}>Choose a session</Text>
                  </View>
                  {addPlan.sessions.map((ses, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[s.pickerRow, addSession?.title === ses.title && { backgroundColor: colors.primary + "18", borderColor: colors.primary }]}
                      onPress={() => { setAddSession(ses); setAddPosition(null); }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.pickerRowText, { color: colors.text }]}>{ses.title}</Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>{ses.exercises.length} exercises</Text>
                      </View>
                      {addSession?.title === ses.title && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Step 3: Pick position */}
              {addSession && (
                <>
                  <View style={[s.stepHeader, { marginTop: spacing.lg }]}>
                    <View style={[s.stepBubble, { backgroundColor: colors.primary }]}><Text style={s.stepBubbleText}>3</Text></View>
                    <Text style={[s.stepLabel, { color: colors.text }]}>Choose position</Text>
                  </View>
                  {/* "At the beginning" */}
                  <TouchableOpacity
                    style={[s.pickerRow, addPosition === -1 && { backgroundColor: colors.primary + "18", borderColor: colors.primary }]}
                    onPress={() => setAddPosition(-1)}
                  >
                    <Ionicons name="arrow-up-circle-outline" size={16} color={colors.primary} />
                    <Text style={[s.pickerRowText, { color: colors.text }]}>At the beginning</Text>
                    {addPosition === -1 && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                  {/* After each existing exercise */}
                  {addSession.exercises.map((ex, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[s.pickerRow, addPosition === i && { backgroundColor: colors.primary + "18", borderColor: colors.primary }]}
                      onPress={() => setAddPosition(i)}
                    >
                      <View style={[s.posNum, { backgroundColor: colors.border }]}>
                        <Text style={[s.posNumText, { color: colors.textSecondary }]}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.pickerRowText, { color: colors.text }]}>After: {ex.name}</Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>{ex.sets}×{ex.reps}</Text>
                      </View>
                      {addPosition === i && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                  {/* "At the end" (default) */}
                  <TouchableOpacity
                    style={[s.pickerRow, addPosition === null && { backgroundColor: colors.primary + "18", borderColor: colors.primary }]}
                    onPress={() => setAddPosition(null)}
                  >
                    <Ionicons name="arrow-down-circle-outline" size={16} color={colors.primary} />
                    <Text style={[s.pickerRowText, { color: colors.text }]}>At the end</Text>
                    {addPosition === null && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
            <View style={s.sheetFooter}>
              {addDone ? (
                <View style={[s.addBtn, { backgroundColor: "#22c55e" }]}>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={s.addBtnText}>Added!</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.addBtn, { backgroundColor: (addPlan && addSession) ? colors.primary : colors.border }]}
                  onPress={() => confirmAddToWorkout()}
                  disabled={!addPlan || !addSession || addSaving}
                >
                  {addSaving ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="add" size={20} color="#fff" />
                      <Text style={s.addBtnText}>
                        {addSession
                          ? addPosition === -1 ? "Add at beginning"
                          : addPosition === null ? "Add at end"
                          : `Add after #${addPosition + 1}`
                          : "Add to session"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailContent({ exercise, colors, s, onAddToWorkout, onClose }) {
  const catColor = CATEGORY_COLORS[exercise.category] || colors.primary;
  return (
    <>
      <View style={[s.sheetStrip, { backgroundColor: catColor }]} />
      <View style={s.sheetHead}>
        <View style={{ flex: 1 }}>
          <View style={s.sheetMeta}>
            <View style={[s.catBadge, { backgroundColor: catColor + "22" }]}>
              <MaterialCommunityIcons name={CATEGORY_ICONS[exercise.category] || "dumbbell"} size={13} color={catColor} />
              <Text style={[s.catBadgeText, { color: catColor }]}>{exercise.category}</Text>
            </View>
            <DiffBadge level={exercise.difficulty} />
          </View>
          <Text style={s.sheetTitle}>{exercise.name}</Text>
          <Text style={s.sheetEquip}>{exercise.equipment}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={s.closeBtn}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.sheetScroll} contentContainerStyle={s.sheetBody}>
        <View style={s.muscleRow}>
          <MuscleGroup label="Primary" muscles={exercise.primaryMuscles} color={catColor} />
          {exercise.secondaryMuscles.length > 0 && (
            <MuscleGroup label="Secondary" muscles={exercise.secondaryMuscles} color={colors.textSecondary} />
          )}
        </View>

        <SectionLabel title="How to perform" colors={colors} />
        {exercise.instructions.map((step, i) => (
          <View key={i} style={s.step}>
            <View style={[s.stepNum, { backgroundColor: catColor }]}>
              <Text style={s.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={[s.stepText, { color: colors.text }]}>{step}</Text>
          </View>
        ))}

        {exercise.tips ? (
          <>
            <SectionLabel title="Pro tip" colors={colors} />
            <View style={[s.tipBox, { backgroundColor: catColor + "15", borderLeftColor: catColor }]}>
              <Ionicons name="bulb-outline" size={16} color={catColor} style={{ marginTop: 1 }} />
              <Text style={[s.tipText, { color: colors.text }]}>{exercise.tips}</Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={s.sheetFooter}>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: catColor }]} onPress={onAddToWorkout}>
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={s.addBtnText}>Add to Workout</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function MuscleGroup({ label, muscles, color }) {
  return (
    <View style={mgBase.wrap}>
      <Text style={mgBase.label}>{label}</Text>
      <View style={mgBase.pills}>
        {muscles.map((m) => (
          <View key={m} style={[mgBase.pill, { backgroundColor: color + "22" }]}>
            <Text style={[mgBase.pillText, { color }]}>{m}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const mgBase = StyleSheet.create({
  wrap: { flex: 1 },
  label: { fontSize: 11, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillText: { fontSize: 11, fontWeight: "600" },
});

function SectionLabel({ title, colors }) {
  return <Text style={[slBase.text, { color: colors.text }]}>{title}</Text>;
}

const slBase = StyleSheet.create({
  text: { fontSize: font.base, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
});

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerBtn: { width: 40, alignItems: "flex-start" },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    searchBar: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      margin: spacing.md, backgroundColor: colors.surface,
      borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10,
      borderWidth: 1, borderColor: colors.border,
    },
    searchInput: { flex: 1, fontSize: font.sm, color: colors.text },
    filterWrap: { borderBottomWidth: 1, borderBottomColor: colors.border },
    filterRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
    filterChip: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing.md, paddingVertical: 6,
      borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterText: { fontSize: font.sm, fontWeight: "600", color: colors.textSecondary },
    filterTextOn: { color: "#fff" },
    countLabel: { fontSize: 12, color: colors.textSecondary, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 2 },
    grid: { padding: spacing.md, gap: spacing.sm },
    row: { gap: spacing.sm, marginBottom: spacing.sm },
    empty: { textAlign: "center", color: colors.textSecondary, marginTop: spacing.xxl, fontSize: font.sm },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      maxHeight: "90%", overflow: "hidden",
    },
    sheetStrip: { height: 5, width: "100%" },
    sheetHead: {
      flexDirection: "row", alignItems: "flex-start",
      padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md,
    },
    sheetMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 6 },
    catBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    catBadgeText: { fontSize: 11, fontWeight: "700" },
    sheetTitle: { fontSize: font.xl, fontWeight: font.bold, color: colors.text, lineHeight: 26 },
    sheetEquip: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    sheetScroll: { flexShrink: 1 },
    sheetBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    muscleRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
    step: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.sm, alignItems: "flex-start" },
    stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    stepNumText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    stepText: { flex: 1, fontSize: font.sm, lineHeight: 20 },
    tipBox: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderLeftWidth: 3 },
    tipText: { flex: 1, fontSize: font.sm, lineHeight: 20, fontStyle: "italic" },
    sheetFooter: { padding: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: 14, borderRadius: radius.md },
    addBtnText: { color: "#fff", fontSize: font.base, fontWeight: font.bold },
    pickerRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
    pickerRowText: { flex: 1, fontSize: font.sm, fontWeight: "600" },
    stepHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
    stepBubble: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    stepBubbleText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    stepLabel: { fontSize: font.base, fontWeight: "700" },
    posNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    posNumText: { fontSize: 11, fontWeight: "700" },
  });
}
