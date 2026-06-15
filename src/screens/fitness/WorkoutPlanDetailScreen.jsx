import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "../../data/exercises";
import { getLocalPlanById, getCustomPlans, isLocalPlan, deleteCustomPlan } from "../../data/workoutPlans";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

const localActiveKey = (uid) => uid ? `sff_active_local_plan_${uid}` : "sff_active_local_plan";
const planHistoryKey = (uid) => uid ? `sff_plan_history_${uid}` : "sff_plan_history";
const exerciseDefaultsKey = (uid) => uid ? `sff_exercise_defaults_${uid}` : "sff_exercise_defaults";

function safeParse(json) {
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch { return []; }
}

export default function WorkoutPlanDetailScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { auth } = useAuth();
  const userId = auth?.userId;
  const planId = route?.params?.planId;
  const isLocal = isLocalPlan(planId);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [plan, setPlan] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectBusy, setSelectBusy] = useState(false);
  const [selectMsg, setSelectMsg] = useState("");
  const [exerciseDefaults, setExerciseDefaults] = useState({});
  const [activePlanId, setActivePlanId] = useState(null);
  const isCustom = String(planId || "").startsWith("custom_") || String(planId || "").startsWith("ai_rec_");
  const isAlreadyActive = activePlanId === planId;

  useEffect(() => {
    if (!planId) { setLoading(false); setErr("No plan ID provided."); return; }
    if (isLocal) {
      // Check local plans first, then custom plans in AsyncStorage
      const localPlan = getLocalPlanById(planId);
      if (localPlan) {
        setPlan(localPlan);
        setSessions(localPlan.sessions.map((s, i) => ({ ...s, id: `${planId}_s${i}`, index: i })));
        setLoading(false);
        return;
      }
      // Try custom plans
      getCustomPlans(userId).then((customs) => {
        const custom = customs.find(p => p.id === planId);
        if (custom) {
          setPlan(custom);
          setSessions(custom.sessions.map((s, i) => ({ ...s, id: `${planId}_s${i}`, index: i })));
        } else {
          setErr("Plan not found.");
        }
        setLoading(false);
      }).catch(() => { setErr("Plan not found."); setLoading(false); });
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true); setErr(""); setSelectMsg("");
        const [planRes, sesRes] = await Promise.all([
          apiClient.get(`/api/workout-plans/${planId}`),
          apiClient.get(`/api/workout-plan-sessions/plan/${planId}`),
        ]);
        if (cancelled) return;
        setPlan(planRes.data || null);
        setSessions(Array.isArray(sesRes.data) ? sesRes.data : []);
      } catch {
        if (!cancelled) setErr("Could not load this workout plan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [planId]);

  async function selectPlan() {
    if (!userId && !isLocal) { setSelectMsg("Log in to select a plan."); return; }
    setSelectBusy(true); setSelectMsg("");
    try {
      if (isLocal) {
        await AsyncStorage.setItem(localActiveKey(userId), planId);
      } else {
        await apiClient.post(`/api/workout-plans/${planId}/select`, null, { params: { userId } });
        await AsyncStorage.setItem(localActiveKey(userId), "");
      }
      // Save to history (keep last 10, most recent first)
      const raw = await AsyncStorage.getItem(planHistoryKey(userId)).catch(() => "[]");
      const history = raw ? JSON.parse(raw) : [];
      const updated = [planId, ...history.filter(id => id !== planId)].slice(0, 10);
      await AsyncStorage.setItem(planHistoryKey(userId), JSON.stringify(updated));
      navigation.dispatch(CommonActions.reset({
        index: 1,
        routes: [{ name: "FitnessMain" }, { name: "WorkoutPlans", params: { initialTab: "myplans" } }],
      }));
    } catch {
      setSelectMsg("Could not select plan.");
      setSelectBusy(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      "Delete Plan",
      `Are you sure you want to delete "${plan?.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            await deleteCustomPlan(planId, userId);
            const active = await AsyncStorage.getItem(localActiveKey(userId)).catch(() => "");
            if (active === planId) await AsyncStorage.setItem(localActiveKey(userId), "");
            navigation.dispatch(CommonActions.reset({
              index: 1,
              routes: [{ name: "FitnessMain" }, { name: "WorkoutPlans", params: { initialTab: "myplans" } }],
            }));
          },
        },
      ]
    );
  }

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      AsyncStorage.getItem(exerciseDefaultsKey(userId)).catch(() => null),
      AsyncStorage.getItem(localActiveKey(userId)).catch(() => null),
    ]).then(([defaultsRaw, activeId]) => {
      if (defaultsRaw) setExerciseDefaults(JSON.parse(defaultsRaw));
      if (activeId) setActivePlanId(activeId);
    });
  }, [userId]);

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Plan Details</Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} /> : null}
        {err ? <Text style={s.errText}>{err}</Text> : null}

        {!loading && !err && plan && (
          <>
            <View style={s.card}>
              <Text style={s.planTitle}>{plan.name || plan.title}</Text>
              <Text style={s.planSub}>{plan.description || plan.shortDescription}</Text>
              <View style={s.metaTags}>
                {[plan.level, plan.goal, `${plan.daysPerWeek ?? "—"} days/week`].filter(Boolean).map((tag) => (
                  <View key={tag} style={s.metaTag}>
                    <Text style={s.metaTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
              {isAlreadyActive ? (
                <View style={s.activeBanner}>
                  <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                  <Text style={s.activeBannerText}>This is your current active plan</Text>
                </View>
              ) : (
                <TouchableOpacity style={s.selectBtn} onPress={selectPlan} disabled={selectBusy}>
                  {selectBusy
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /><Text style={s.selectBtnText}>Select this plan</Text></>}
                </TouchableOpacity>
              )}
              {selectMsg ? <Text style={[s.selectMsg, selectMsg.includes("✅") && s.selectMsgOk]}>{selectMsg}</Text> : null}
              {isCustom && (
                <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                  <Text style={[s.deleteBtnText, { color: colors.error }]}>Delete Plan</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={s.card}>
              <Text style={s.sectionTitle}>Sessions ({sessions.length})</Text>
              {sessions.length === 0 ? <Text style={s.empty}>No sessions found.</Text> : null}
              {sessions.map((ses, si) => {
                const exList = isLocal ? (ses.exercises || []) : safeParse(ses.exerciseJson);
                return (
                  <View key={ses.id || si} style={s.sessionBlock}>
                    <View style={s.sessionTop}>
                      <Text style={s.sessionName}>{ses.title}</Text>
                      {!isLocal && ses.focus ? <Text style={s.sessionMeta}>{ses.focus} • {ses.estimatedMinutes ?? "—"}m</Text> : null}
                      {isLocal ? <Text style={s.sessionMeta}>{exList.length} exercises</Text> : null}
                    </View>
                    {exList.slice(0, 8).map((ex, i) => {
                      const catColor = isLocal ? (CATEGORY_COLORS[ex.category] || colors.primary) : colors.primary;
                      return (
                        <View key={i} style={s.exRow}>
                          {isLocal && (
                            <View style={[s.exDot, { backgroundColor: catColor }]} />
                          )}
                          <Text style={s.exName}>{ex.name}</Text>
                          <View style={s.exChips}>
                            <View style={s.exChip}><Text style={s.exChipText}>{exerciseDefaults[ex.name]?.sets ?? ex.sets ?? 3} sets</Text></View>
                            {exerciseDefaults[ex.name]?.weight ? (
                              <View style={[s.exChip, s.exChipWeight]}><Text style={[s.exChipText, { color: colors.primary }]}>{exerciseDefaults[ex.name].weight} kg</Text></View>
                            ) : null}
                            <View style={s.exChip}><Text style={s.exChipText}>{exerciseDefaults[ex.name]?.reps ?? ex.reps ?? "10"} reps</Text></View>
                          </View>
                        </View>
                      );
                    })}
                    {exList.length > 8 ? <Text style={s.moreEx}>+{exList.length - 8} more</Text> : null}
                    <TouchableOpacity
                      style={s.startBtn}
                      onPress={() => navigation.navigate("Workout", { localPlanId: isLocal ? planId : null, sessionIndex: si })}
                    >
                      <Ionicons name="play" size={14} color={colors.primary} />
                      <Text style={s.startBtnText}>Start this session</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerBtn: { width: 40 },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    body: { padding: spacing.lg, gap: spacing.md },
    errText: { color: colors.error, textAlign: "center", fontSize: font.sm },
    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    planTitle: { fontSize: font.xl, fontWeight: font.bold, color: colors.text },
    planSub: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20 },
    metaTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    metaTag: { backgroundColor: colors.background, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
    metaTagText: { fontSize: 11, color: colors.textSecondary },
    activeBanner: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: "rgba(34,197,94,0.12)", borderRadius: radius.md,
      paddingVertical: 12, marginTop: spacing.sm,
    },
    activeBannerText: { fontSize: font.base, fontWeight: font.semiBold, color: "#22c55e" },
    selectBtn: {
      backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: "center", marginTop: spacing.sm,
      flexDirection: "row", justifyContent: "center", gap: 8,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
    },
    selectBtnText: { color: "#fff", fontWeight: font.bold, fontSize: font.base },
    selectMsg: { textAlign: "center", fontSize: font.sm, color: colors.error },
    selectMsgOk: { color: "#22c55e" },
    deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.error, marginTop: 4 },
    deleteBtnText: { fontSize: font.sm, fontWeight: font.semiBold },
    sectionTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    empty: { color: colors.textSecondary, fontSize: font.sm },
    sessionBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm },
    sessionTop: { marginBottom: 2 },
    sessionName: { fontSize: font.base, fontWeight: font.bold, color: colors.text },
    sessionMeta: { fontSize: font.sm, color: colors.textSecondary },
    exRow: { flexDirection: "row", alignItems: "center", paddingVertical: 3, gap: spacing.sm },
    exDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    exName: { fontSize: font.sm, color: colors.text, flex: 1 },
    exChips: { flexDirection: "row", gap: 4, flexShrink: 0 },
    exChip: { backgroundColor: colors.background, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
    exChipWeight: { backgroundColor: colors.insightBg },
    exChipText: { fontSize: 10, color: colors.textSecondary, fontWeight: font.semiBold },
    moreEx: { fontSize: 11, color: colors.textSecondary, fontStyle: "italic" },
    startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingVertical: 9, marginTop: 4 },
    startBtnText: { color: colors.primary, fontWeight: font.semiBold, fontSize: font.sm },
  });
}
