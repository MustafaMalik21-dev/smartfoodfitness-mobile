import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { postNotification } from "../../utils/notificationService";
import { isNotifEnabled } from "../../utils/notificationScheduler";
import { EXERCISES } from "../../data/exercises";
import { getPlanByIdAsync, isLocalPlan } from "../../data/workoutPlans";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

const localActiveKey = (uid) => uid ? `sff_active_local_plan_${uid}` : "sff_active_local_plan";
const queueKey = (uid) => uid ? `sff_workout_queue_${uid}` : "sff_workout_queue";
const exerciseDefaultsKey = (uid) => uid ? `sff_exercise_defaults_${uid}` : "sff_exercise_defaults";

const WEIGHT_OPTIONS = [
  { label: "—", value: "" },
  ...Array.from({ length: 20 }, (_, i) => { const v = 2.5 + i * 2.5; return { label: `${v} kg`, value: String(v) }; }),
  ...Array.from({ length: 10 }, (_, i) => { const v = 55 + i * 5; return { label: `${v} kg`, value: String(v) }; }),
  ...Array.from({ length: 10 }, (_, i) => { const v = 110 + i * 10; return { label: `${v} kg`, value: String(v) }; }),
];
const REPS_OPTIONS = Array.from({ length: 30 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }));
const DURATION_OPTIONS = [
  { label: "—", value: "" },
  ...[ 1,2,3,4,5,6,7,8,9,10,12,15,20,25,30,35,40,45,50,55,60,70,75,90,100,120 ].map(v => ({ label: `${v} min`, value: String(v) })),
];
const DISTANCE_OPTIONS = [
  { label: "—", value: "" },
  ...[ 0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,6,7,8,9,10,12,15,20,25,30 ].map(v => ({ label: `${v} km`, value: String(v) })),
];

function cleanText(s) { return String(s || "").replace(/\s+/g, " ").trim(); }

function fmtTime(totalSec) {
  const s = Math.max(0, totalSec | 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
}

function buildDefaultSets(targetSets = 3, reps = 8, defaultWeight = "") {
  const n = Math.max(1, Math.min(Number(targetSets) || 3, 12));
  const r = String(Number(reps) || 8);
  return Array.from({ length: n }).map(() => ({ weight: defaultWeight, reps: r, done: false }));
}

// Inserts extras into base at their _insertAfter positions.
// _insertAfter: -1 = beginning, null = end, N = after index N in the original base array.
function insertAtPositions(base, extras) {
  if (!extras.length) return base;
  const result = [...base];
  // Process from highest to lowest insertion index so earlier inserts don't shift later ones
  const sorted = [...extras].sort((a, b) => {
    const pa = a._insertAfter === null ? Infinity : a._insertAfter === -1 ? -1 : a._insertAfter;
    const pb = b._insertAfter === null ? Infinity : b._insertAfter === -1 ? -1 : b._insertAfter;
    return pb - pa;
  });
  for (const item of sorted) {
    const { _insertAfter, ...rest } = item;
    let pos;
    if (_insertAfter === -1) pos = 0;
    else if (_insertAfter === null || _insertAfter === undefined) pos = result.length;
    else pos = Math.min(_insertAfter + 1, result.length);
    result.splice(pos, 0, rest);
  }
  return result;
}

function useWorkoutTimer() {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startEpochRef = useRef(null);
  const baseElapsedRef = useRef(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isRunning) return;
    startEpochRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const delta = Math.floor((Date.now() - startEpochRef.current) / 1000);
      setElapsedSec(baseElapsedRef.current + delta);
    }, 250);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  function start() {
    if (elapsedSec > 0) return;
    baseElapsedRef.current = 0; setElapsedSec(0); setIsRunning(true);
  }
  function pause() {
    if (!isRunning) return;
    const delta = Math.floor((Date.now() - startEpochRef.current) / 1000);
    baseElapsedRef.current += delta; setElapsedSec(baseElapsedRef.current); setIsRunning(false);
  }
  function resume() {
    if (isRunning || elapsedSec === 0) return;
    setIsRunning(true);
  }
  function stop() {
    if (!isRunning) return;
    const delta = Math.floor((Date.now() - startEpochRef.current) / 1000);
    baseElapsedRef.current += delta; setElapsedSec(baseElapsedRef.current); setIsRunning(false);
  }

  return { elapsedSec, isRunning, start, pause, resume, stop };
}

export default function WorkoutScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { auth } = useAuth();
  const userId = auth?.userId;
  const routeLocalPlanId = route?.params?.localPlanId ?? null;
  const routeSessionIndex = route?.params?.sessionIndex ?? 0;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [planId, setPlanId] = useState(null);
  const [sessionTitle, setSessionTitle] = useState("Workout");
  const [exercises, setExercises] = useState([]);
  const [idx, setIdx] = useState(0);
  const [ending, setEnding] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);
  const [pickerTemp, setPickerTemp] = useState("");

  const { elapsedSec, isRunning, start, pause, resume, stop } = useWorkoutTimer();

  const current = exercises[idx] || null;
  const total = exercises.length || 1;
  const hasPlan = !!planId;

  useEffect(() => {
    if (!userId) { setLoading(false); setErr("No user logged in."); return; }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true); setErr("");

        // Check for queue items to add
        let queueItems = [];
        try {
          const raw = await AsyncStorage.getItem(queueKey(userId));
          queueItems = raw ? JSON.parse(raw) : [];
        } catch {}

        // Load exercise weight/reps defaults
        let exerciseDefaults = {};
        try {
          const defRaw = await AsyncStorage.getItem(exerciseDefaultsKey(userId));
          exerciseDefaults = defRaw ? JSON.parse(defRaw) : {};
        } catch {}

        // Determine which plan to load
        const localIdFromRoute = routeLocalPlanId;
        const localIdFromStorage = await AsyncStorage.getItem(localActiveKey(userId)).catch(() => "");

        const effectiveLocalId = localIdFromRoute || (isLocalPlan(localIdFromStorage) ? localIdFromStorage : null);

        if (effectiveLocalId) {
          // Load from local/custom plans
          const localPlan = await getPlanByIdAsync(effectiveLocalId, userId);
          if (!localPlan) { if (!cancelled) { setExercises([]); setErr("Plan not found."); } return; }
          const sessIdx = routeSessionIndex ?? 0;
          const session = localPlan.sessions[sessIdx % localPlan.sessions.length];
          if (!cancelled) setPlanId(effectiveLocalId);
          const normalized = (session?.exercises || []).map((x, i) => {
            const localEx = EXERCISES.find((e) => e.id === x.exerciseId);
            const def = exerciseDefaults[x.name] || {};
            let notes = "";
            if (localEx) {
              const steps = (localEx.instructions || []).map((inst, n) => `${n + 1}. ${inst}`);
              const tipLine = localEx.tips ? `\nTips: ${localEx.tips}` : "";
              notes = steps.join("\n") + tipLine;
            } else {
              notes = cleanText(x.notes || "");
            }
            return {
              key: `${x.exerciseId || x.name}-${i}`,
              name: x.name,
              notes,
              category: x.category,
              sets: buildDefaultSets(def.sets ?? x.sets ?? 3, def.reps ?? x.reps ?? 8, def.weight ? String(def.weight) : (x?.weight ? String(x.weight) : "")),
            };
          }).filter((x) => x.name);

          // Merge queue items at their chosen positions
          const relevantQueue = queueItems.filter((q) => q.sessionTitle === session?.title);
          const extra = relevantQueue
            .filter((q) => !normalized.find((e) => e.name === q.name))
            .map((q, i) => ({ key: `queue-${i}`, name: q.name, notes: "", category: q.category, sets: buildDefaultSets(3, 8), _insertAfter: q.insertAfter ?? null }));
          if (extra.length) await AsyncStorage.removeItem(queueKey(userId));

          const merged = insertAtPositions(normalized, extra);
          if (!cancelled) { setSessionTitle(session?.title || "Workout"); setExercises(merged); setIdx(0); }
        } else {
          // Load from backend
          const prof = await apiClient.get(`/api/user-profile/${userId}`);
          const selected = prof?.data?.selectedWorkoutPlanId;
          if (!cancelled) setPlanId(selected || null);
          if (!selected) { if (!cancelled) { setExercises([]); setIdx(0); } return; }
          const s = await apiClient.get(`/api/workout-plan-sessions/plan/${selected}`);
          const sessions = Array.isArray(s.data) ? s.data : [];
          const first = sessions[0];
          if (!first) { if (!cancelled) { setExercises([]); setIdx(0); } return; }
          const raw = Array.isArray(first.exercises) ? first.exercises : [];
          const normalized = raw.map((x, i) => {
            const name = cleanText(x?.name);
            if (!name) return null;
            const def = exerciseDefaults[name] || {};
            return { key: `${name}-${i}`, name, notes: cleanText(x?.notes || ""), sets: buildDefaultSets(def.sets ?? x?.sets ?? 3, def.reps ?? x?.reps ?? 8, def.weight ? String(def.weight) : (x?.weight ? String(x.weight) : "")) };
          }).filter(Boolean);

          // Merge queue items at their chosen positions
          const extra = queueItems
            .filter((q) => !normalized.find((e) => e.name === q.name))
            .map((q, i) => ({ key: `queue-${i}`, name: q.name, notes: "", sets: buildDefaultSets(3, 8), _insertAfter: q.insertAfter ?? null }));
          if (extra.length) await AsyncStorage.removeItem(queueKey(userId));

          const merged = insertAtPositions(normalized, extra);
          if (!cancelled) { setSessionTitle(first.title || "Workout"); setExercises(merged); setIdx(0); }
        }
      } catch {
        if (!cancelled) { setExercises([]); setIdx(0); setErr("Could not load workout."); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, routeLocalPlanId, routeSessionIndex]);

  function setIdxSafe(next) { setIdx(Math.max(0, Math.min(exercises.length - 1, next))); }

  function toggleDone(setIndex) {
    setExercises((prev) => prev.map((ex, exI) => exI !== idx ? ex : {
      ...ex, sets: ex.sets.map((s, i) => i === setIndex ? { ...s, done: !s.done } : s),
    }));
  }

  function editSet(setIndex, field, value) {
    setExercises((prev) => prev.map((ex, exI) => exI !== idx ? ex : {
      ...ex, sets: ex.sets.map((s, i) => i === setIndex ? { ...s, [field]: value } : s),
    }));
  }

  function addSet() {
    setExercises((prev) => prev.map((ex, exI) => {
      if (exI !== idx) return ex;
      const last = ex.sets[ex.sets.length - 1] || { weight: "", reps: "8", done: false };
      return { ...ex, sets: [...ex.sets, { weight: last.weight, reps: last.reps, done: false }] };
    }));
  }

  function removeSet(setIndex) {
    setExercises((prev) => prev.map((ex, exI) => {
      if (exI !== idx || ex.sets.length <= 1) return ex;
      return { ...ex, sets: ex.sets.filter((_, i) => i !== setIndex) };
    }));
  }

  function openPicker(setIndex, field, currentValue) {
    setPickerTarget({ setIndex, field });
    setPickerTemp(currentValue || (field === "reps" ? "8" : ""));
    setPickerVisible(true);
  }

  function confirmPicker() {
    if (pickerTarget) editSet(pickerTarget.setIndex, pickerTarget.field, pickerTemp);
    setPickerVisible(false);
  }

  async function endWorkout() {
    stop();
    setEnding(true);
    const performedAt = new Date().toISOString();
    const durationMinutes = Math.max(1, Math.round(elapsedSec / 60));
    const details = {
      planId, sessionTitle, performedAt, durationSeconds: elapsedSec,
      exercises: exercises.map((ex) => ({
        name: ex.name, guide: cleanText(ex.notes).slice(0, 4000), image: "",
        sets: ex.sets.map((s) => ({ weight: String(s.weight || "").trim(), reps: String(s.reps || "").trim(), done: !!s.done })),
      })),
    };
    try {
      await apiClient.post("/api/workout-logs", {
        userId: Number(userId), workoutName: sessionTitle || "Workout", workoutType: "Workout",
        durationMinutes, performedAt, notes: planId ? `Plan ${planId} | ${sessionTitle}` : sessionTitle,
        detailsJson: JSON.stringify(details),
      });
      const doneCount = exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
      if (await isNotifEnabled("workouts")) postNotification(
        userId, "workout",
        `Workout complete! 💪`,
        `You finished "${sessionTitle || "your workout"}" in ${durationMinutes} min with ${doneCount} set${doneCount !== 1 ? "s" : ""} logged. Great work!`
      );
    } catch {}
    try {
      const defRaw = await AsyncStorage.getItem(exerciseDefaultsKey(userId));
      const defs = defRaw ? JSON.parse(defRaw) : {};
      for (const ex of exercises) {
        if (ex.category === "Cardio") continue;
        const doneSets = ex.sets.filter((s) => s.done);
        if (!doneSets.length) continue;
        const last = doneSets[doneSets.length - 1];
        if (last.weight || last.reps) {
          defs[ex.name] = {
            ...(defs[ex.name] || {}),
            sets: String(ex.sets.length),
            weight: last.weight || defs[ex.name]?.weight || "",
            reps: last.reps || defs[ex.name]?.reps || "",
          };
        }
      }
      await AsyncStorage.setItem(exerciseDefaultsKey(userId), JSON.stringify(defs));
    } catch {}
    setEnding(false);
    navigation.goBack();
  }

  const showStart = elapsedSec === 0 && !isRunning;
  const showPause = elapsedSec > 0 && isRunning;
  const showResume = elapsedSec > 0 && !isRunning;
  const isCardio = current?.category === "Cardio";

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Workout</Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} /> : null}
        {err ? <Text style={s.errText}>{err}</Text> : null}

        {!loading && !err && !hasPlan ? (
          <View style={s.emptyCard}>
            <Ionicons name="barbell-outline" size={48} color={colors.textSecondary} />
            <Text style={s.emptyTitle}>No workout plan selected</Text>
            <Text style={s.emptySub}>Select a plan first to start a workout.</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.navigate("WorkoutPlans")}>
              <Text style={s.primaryBtnText}>Select a plan</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && !err && hasPlan && current ? (
          <>
            <View style={s.metaRow}>
              <Text style={s.metaLeft}>Exercise {Math.min(idx + 1, total)}/{total}</Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.metaSmall}>Today's session:</Text>
                <Text style={s.metaBold}>{sessionTitle}</Text>
              </View>
            </View>

            <View style={s.exerciseCard}>
              <Text style={s.exerciseName}>{current.name}</Text>
              {current.notes ? <Text style={s.exerciseNotes}>{current.notes}</Text> : null}
              <View style={s.navRow}>
                <TouchableOpacity style={[s.navBtn, idx === 0 && s.navBtnDisabled]} onPress={() => setIdxSafe(idx - 1)} disabled={idx === 0}>
                  <Ionicons name="chevron-back" size={20} color={idx === 0 ? colors.textSecondary : "#fff"} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.navBtn, s.navBtnPrimary, idx >= exercises.length - 1 && s.navBtnDisabled]}
                  onPress={() => setIdxSafe(idx + 1)}
                  disabled={idx >= exercises.length - 1}
                >
                  <Text style={s.navBtnText}>Next Exercise</Text>
                  <Ionicons name="chevron-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.setsCard}>
              <View style={s.setsHeader}>
                <Text style={[s.setCol, { flex: 0.5 }]}>{isCardio ? "Round" : "Set"}</Text>
                <Text style={[s.setCol, { flex: 1 }]}>{isCardio ? "Dist (km)" : "Weight"}</Text>
                <Text style={[s.setCol, { flex: 1 }]}>{isCardio ? "Duration" : "Reps"}</Text>
                <Text style={[s.setCol, { flex: 0.5 }]}></Text>
                <Text style={[s.setCol, { flex: 0.5 }]}></Text>
              </View>
              {current.sets.map((set, i) => (
                <View key={i} style={s.setRow}>
                  <View style={s.setPill}><Text style={s.setPillText}>{i + 1}</Text></View>
                  <TouchableOpacity style={[s.setPickerBtn, { flex: 1 }]} onPress={() => openPicker(i, "weight", set.weight)}>
                    <Text style={[s.setPickerText, !set.weight && s.setPickerPlaceholder]}>
                      {set.weight ? (isCardio ? `${set.weight} km` : set.weight) : "—"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.setPickerBtn, { flex: 1 }]} onPress={() => openPicker(i, "reps", set.reps)}>
                    <Text style={s.setPickerText}>
                      {set.reps ? (isCardio ? `${set.reps} min` : set.reps) : "—"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.tickBtn, set.done && s.tickBtnOn]} onPress={() => toggleDone(i)}>
                    <Ionicons name={set.done ? "checkmark-circle" : "ellipse-outline"} size={22} color={set.done ? "#fff" : colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeSet(i)} style={s.minusBtn}>
                    <Ionicons name="remove-circle-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={s.addSetBtn} onPress={addSet}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={s.addSetText}>Add Set</Text>
              </TouchableOpacity>
            </View>

            <View style={s.timerCard}>
              <Text style={s.timerLabel}>Time Spent Working Out</Text>
              <Text style={s.timerValue}>{fmtTime(elapsedSec)}</Text>
              <View style={s.timerBtns}>
                {showStart ? <TouchableOpacity style={s.timerBtn} onPress={start}><Text style={s.timerBtnText}>Start</Text></TouchableOpacity> : null}
                {showPause ? <TouchableOpacity style={[s.timerBtn, s.timerBtnSecondary]} onPress={pause}><Text style={s.timerBtnSecText}>Pause</Text></TouchableOpacity> : null}
                {showResume ? <TouchableOpacity style={s.timerBtn} onPress={resume}><Text style={s.timerBtnText}>Resume</Text></TouchableOpacity> : null}
              </View>
            </View>

            <TouchableOpacity style={s.endBtn} onPress={endWorkout} disabled={ending}>
              {ending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.endBtnText}>End Workout</Text>}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={s.pickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPickerVisible(false)} />
          <View style={s.pickerSheet}>
            <View style={s.pickerToolbar}>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={s.pickerCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.pickerTitle}>
                {pickerTarget?.field === "weight"
                  ? (isCardio ? "Distance (km)" : "Weight (kg)")
                  : (isCardio ? "Duration (min)" : "Reps")}
              </Text>
              <TouchableOpacity onPress={confirmPicker}>
                <Text style={s.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={pickerTemp}
              onValueChange={(v) => setPickerTemp(v)}
              style={[s.pickerWheel, { backgroundColor: colors.surface }]}
              itemStyle={{ color: colors.text, backgroundColor: colors.surface }}
            >
              {(pickerTarget?.field === "weight"
                ? (isCardio ? DISTANCE_OPTIONS : WEIGHT_OPTIONS)
                : (isCardio ? DURATION_OPTIONS : REPS_OPTIONS)
              ).map((opt) => (
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
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerBtn: { width: 40 },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xs },
    errText: { color: colors.error, textAlign: "center", fontSize: font.sm },
    emptyCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", gap: spacing.md, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
    emptyTitle: { fontSize: font.xl, fontWeight: font.bold, color: colors.text },
    emptySub: { fontSize: font.sm, color: colors.textSecondary, textAlign: "center" },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: spacing.xl },
    primaryBtnText: { color: "#fff", fontWeight: font.bold, fontSize: font.base },
    metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    metaLeft: { fontSize: font.sm, color: colors.textSecondary },
    metaSmall: { fontSize: font.sm, color: colors.textSecondary },
    metaBold: { fontSize: font.base, fontWeight: font.bold, color: colors.text },
    exerciseCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
    exerciseName: { fontSize: font.xl, fontWeight: font.bold, color: colors.text },
    exerciseNotes: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20 },
    navRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
    navBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
    navBtnPrimary: { flex: 1, flexDirection: "row", backgroundColor: colors.primary, borderRadius: radius.lg, gap: 4 },
    navBtnDisabled: { opacity: 0.4 },
    navBtnText: { color: "#fff", fontWeight: font.bold, fontSize: font.base },
    setsCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
    setsHeader: { flexDirection: "row", paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    setCol: { fontSize: font.sm, fontWeight: font.bold, color: colors.textSecondary },
    setRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    setPill: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    setPillText: { color: "#fff", fontSize: font.sm, fontWeight: font.bold },
    setPickerBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 4, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", minHeight: 34 },
    setPickerText: { fontSize: font.sm, color: colors.text, textAlign: "center" },
    setPickerPlaceholder: { color: colors.textSecondary },
    tickBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    tickBtnOn: { backgroundColor: colors.success, borderColor: colors.success },
    minusBtn: { padding: 4 },
    addSetBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: spacing.sm },
    addSetText: { color: colors.primary, fontSize: font.sm, fontWeight: font.semiBold },
    timerCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", gap: spacing.sm, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
    timerLabel: { fontSize: font.sm, color: colors.textSecondary },
    timerValue: { fontSize: 28, fontWeight: font.bold, color: colors.text, fontVariant: ["tabular-nums"] },
    timerBtns: { flexDirection: "row", gap: spacing.sm },
    timerBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: spacing.xl },
    timerBtnText: { color: "#fff", fontWeight: font.bold },
    timerBtnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    timerBtnSecText: { color: colors.text, fontWeight: font.bold },
    endBtn: { backgroundColor: colors.error, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
    endBtnText: { color: "#fff", fontSize: font.lg, fontWeight: font.bold },
    pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: 32 },
    pickerToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    pickerTitle: { fontSize: font.base, fontWeight: font.semiBold, color: colors.text },
    pickerCancel: { fontSize: font.base, color: colors.textSecondary },
    pickerDone: { fontSize: font.base, fontWeight: font.bold, color: colors.primary },
    pickerWheel: { height: 200 },
  });
}
