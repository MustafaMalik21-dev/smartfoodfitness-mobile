import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function getDoneSetCount(ex) {
  return (Array.isArray(ex?.sets) ? ex.sets : []).reduce((acc, st) => acc + (st?.done ? 1 : 0), 0);
}

function getTotalSetCount(ex) {
  return Array.isArray(ex?.sets) ? ex.sets.length : 0;
}

export default function WorkoutHistoryScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { auth } = useAuth();
  const userId = auth?.userId;

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [openKey, setOpenKey] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setErr("");
    try {
      const res = await apiClient.get(`/api/workout-logs/user/${userId}`);
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch {
      setLogs([]); setErr("Could not load workout history.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const view = useMemo(() => {
    return (logs || []).slice().sort((a, b) => {
      return new Date(b?.performedAt || 0) - new Date(a?.performedAt || 0);
    }).map((l) => {
      const details = typeof l.detailsJson === "string" ? safeJsonParse(l.detailsJson) : null;
      const exercises = Array.isArray(details?.exercises) ? details.exercises : [];
      const totalExercises = exercises.length;
      const completedExercises = exercises.reduce((acc, ex) => acc + (getDoneSetCount(ex) > 0 ? 1 : 0), 0);
      return { id: l.id, performedAt: l.performedAt, workoutName: l.workoutName, durationMinutes: l.durationMinutes, notes: l.notes, totalExercises, completedExercises, exercises };
    });
  }, [logs]);

  function toggleExercise(logId, exIndex) {
    const key = `${logId}::${exIndex}`;
    setOpenKey((prev) => (prev === key ? "" : key));
  }

  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Workout History</Text>
        <TouchableOpacity onPress={load} disabled={loading} style={s.headerBtn}>
          <Ionicons name="refresh-outline" size={22} color={loading ? colors.textSecondary : colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} /> : null}
        {err ? <Text style={s.errText}>{err}</Text> : null}

        {!loading && !err && view.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="fitness-outline" size={48} color={colors.textSecondary} />
            <Text style={s.emptyTitle}>No workouts yet</Text>
            <Text style={s.emptySub}>Once you complete workouts, they'll show here.</Text>
          </View>
        ) : null}

        {view.map((item) => (
          <View key={item.id} style={s.card}>
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.workoutName}>{item.workoutName}</Text>
                <Text style={s.when}>{formatWhen(item.performedAt)}</Text>
              </View>
              <View style={s.pills}>
                {item.durationMinutes != null ? (
                  <View style={s.pill}><Text style={s.pillText}>{item.durationMinutes} min</Text></View>
                ) : null}
                <View style={[s.pill, s.pillSoft]}>
                  <Text style={s.pillSoftText}>{item.completedExercises}/{item.totalExercises} done</Text>
                </View>
              </View>
            </View>

            {item.notes ? <Text style={s.notes}>{item.notes}</Text> : null}

            {item.exercises.length > 0 ? (
              <View style={s.exerciseList}>
                {item.exercises.map((ex, idx) => {
                  const done = getDoneSetCount(ex);
                  const total = getTotalSetCount(ex);
                  const key = `${item.id}::${idx}`;
                  const isOpen = openKey === key;
                  const sets = Array.isArray(ex?.sets) ? ex.sets : [];

                  return (
                    <View key={key} style={s.exerciseBlock}>
                      <TouchableOpacity style={s.exerciseRow} onPress={() => toggleExercise(item.id, idx)}>
                        <Text style={s.exName}>{ex?.name || "Exercise"}</Text>
                        <View style={s.exRight}>
                          <View style={[s.exPill, done > 0 && s.exPillDone]}>
                            <Text style={[s.exPillText, done > 0 && s.exPillTextDone]}>{total ? `${done}/${total}` : "—"}</Text>
                          </View>
                          <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
                        </View>
                      </TouchableOpacity>

                      {isOpen ? (
                        <View style={s.setsPanel}>
                          {sets.length > 0 ? sets.map((st, sIdx) => {
                            const w = st?.weight ? String(st.weight).trim() : null;
                            const r = st?.reps ? String(st.reps).trim() : null;
                            const doneSet = !!st?.done;
                            return (
                              <View key={sIdx} style={[s.setRow, doneSet && s.setRowDone]}>
                                <View style={{ flex: 1 }}>
                                  <Text style={s.setNum}>Set {sIdx + 1}</Text>
                                  <View style={s.setMeta}>
                                    <View style={s.setTag}><Text style={s.setTagText}>{w || "—"}</Text></View>
                                    <View style={s.setTag}><Text style={s.setTagText}>{r ? `${r} reps` : "—"}</Text></View>
                                  </View>
                                </View>
                                <Text style={[s.setStatus, doneSet && s.setStatusDone]}>{doneSet ? "Done" : "Not done"}</Text>
                              </View>
                            );
                          }) : (
                            <Text style={s.noSets}>No set details recorded.</Text>
                          )}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={s.noExercises}>No exercise details recorded.</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors, isDark) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerBtn: { width: 40 },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    body: { padding: spacing.lg, gap: spacing.md },
    errText: { color: colors.error, textAlign: "center", fontSize: font.sm },
    emptyCard: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl },
    emptyTitle: { fontSize: font.xl, fontWeight: font.bold, color: colors.text },
    emptySub: { fontSize: font.sm, color: colors.textSecondary, textAlign: "center" },
    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    workoutName: { fontSize: font.base, fontWeight: font.bold, color: colors.text },
    when: { fontSize: font.sm, color: colors.textSecondary },
    pills: { gap: 4, alignItems: "flex-end" },
    pill: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
    pillText: { color: "#fff", fontSize: 11, fontWeight: font.bold },
    pillSoft: { backgroundColor: colors.background },
    pillSoftText: { fontSize: 11, color: colors.textSecondary },
    notes: { fontSize: font.sm, color: colors.textSecondary, fontStyle: "italic" },
    exerciseList: { gap: 2 },
    exerciseBlock: { borderRadius: radius.sm, overflow: "hidden" },
    exerciseRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
    exName: { fontSize: font.sm, color: colors.text, flex: 1 },
    exRight: { flexDirection: "row", alignItems: "center", gap: 6 },
    exPill: { backgroundColor: colors.background, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
    exPillDone: { backgroundColor: isDark ? "rgba(74,222,128,0.15)" : "#dcfce7" },
    exPillText: { fontSize: 11, color: colors.textSecondary },
    exPillTextDone: { color: isDark ? "#4ade80" : "#16a34a" },
    setsPanel: { backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.sm, gap: 4 },
    setRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
    setRowDone: { backgroundColor: isDark ? "rgba(74,222,128,0.08)" : "#f0fdf4" },
    setNum: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
    setMeta: { flexDirection: "row", gap: 6 },
    setTag: { backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
    setTagText: { fontSize: 11, color: colors.text },
    setStatus: { fontSize: 11, color: colors.textSecondary, fontWeight: font.semiBold },
    setStatusDone: { color: isDark ? "#4ade80" : "#16a34a" },
    noSets: { fontSize: font.sm, color: colors.textSecondary, fontStyle: "italic", padding: spacing.sm },
    noExercises: { fontSize: font.sm, color: colors.textSecondary, fontStyle: "italic" },
  });
}
