import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import TourTarget from "../../tour/TourTarget";
import { useTour } from "../../tour/TourContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { StackActions } from "@react-navigation/native";
import { useAuth } from "../../auth/useAuth";
import apiClient from "../../api/apiClient";
import { LOCAL_PLANS, getLocalPlanById, getCustomPlans, saveCustomPlan } from "../../data/workoutPlans";
import { generateAIPlan } from "../../api/aiPlanGenerator";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const GOALS  = ["Strength", "Muscle Gain", "Fat Loss", "General Fitness"];
const localActiveKey  = (uid) => uid ? `sff_active_local_plan_${uid}` : "sff_active_local_plan";
const planHistoryKey  = (uid) => uid ? `sff_plan_history_${uid}` : "sff_plan_history";
const recPlanKey      = (uid) => uid ? `sff_ai_plan_${uid}` : "sff_ai_plan";
const recAnswersKey   = (uid) => uid ? `sff_rec_answers_${uid}` : "sff_rec_answers";

const EQUIPMENT_OPTIONS = ["Full Gym", "Barbell & Dumbbells", "Dumbbells Only", "Bodyweight Only"];
const EQUIPMENT_ICONS = {
  "Full Gym":             "fitness-outline",
  "Barbell & Dumbbells":  "barbell-outline",
  "Dumbbells Only":       "hand-left-outline",
  "Bodyweight Only":      "body-outline",
};

const GOAL_COLORS = {
  "Muscle Gain":    "#8b5cf6",
  "Strength":       "#ef4444",
  "Fat Loss":       "#f97316",
  "General Fitness":"#22c55e",
  "Custom":         "#0b84ff",
};
const LEVEL_COLORS = {
  "Beginner":     "#22c55e",
  "Intermediate": "#f59e0b",
  "Advanced":     "#ef4444",
  "Custom":       "#0b84ff",
};

export default function WorkoutPlansScreen({ navigation, route }) {
  const { colors, isDark } = useTheme();
  const { auth } = useAuth();
  const userId = auth?.userId;
  const { startPlansTour } = useTour();
  const [source, setSource] = useState(route?.params?.initialTab === "myplans" ? "mine" : "all");
  const [level, setLevel]   = useState("Beginner");
  const [goal, setGoal]     = useState("Fat Loss");

  // My Plans tab state
  const [activePlan,  setActivePlan]  = useState(null);
  const [historyPlans, setHistoryPlans] = useState([]);
  const [customPlans,  setCustomPlans]  = useState([]);
  const [myLoading,   setMyLoading]   = useState(false);

  // Recommended tab state
  const [recProfile,   setRecProfile]   = useState(null);
  const [recPlan,      setRecPlan]      = useState(null);
  const [recLoading,   setRecLoading]   = useState(false);
  const [recSaving,    setRecSaving]    = useState(false);
  const [recSaved,     setRecSaved]     = useState(false);
  const [recExpanded,  setRecExpanded]  = useState({});
  const [recAnswers,   setRecAnswers]   = useState(null); // { daysPerWeek, equipment }
  const [recAiLoading, setRecAiLoading] = useState(false);
  const [recAiError,   setRecAiError]   = useState(null);

  // Switch tab if navigation param changes
  useEffect(() => {
    if (route?.params?.initialTab === "myplans") setSource("mine");
  }, [route?.params?.initialTab]);

  // Trigger plans sub-tour on first visit
  useEffect(() => { startPlansTour(); }, []);

  const loadMyPlans = useCallback(async () => {
    setMyLoading(true);
    try {
      const [activeId, historyRaw, customs] = await Promise.all([
        AsyncStorage.getItem(localActiveKey(userId)).catch(() => ""),
        AsyncStorage.getItem(planHistoryKey(userId)).catch(() => "[]"),
        getCustomPlans(userId),
      ]);
      const histIds = historyRaw ? JSON.parse(historyRaw) : [];
      const active = activeId ? (getLocalPlanById(activeId) || customs.find(p => p.id === activeId)) : null;
      const history = histIds
        .filter(id => id !== activeId)
        .map(id => getLocalPlanById(id) || customs.find(p => p.id === id))
        .filter(Boolean);
      setActivePlan(active || null);
      setHistoryPlans(history);
      setCustomPlans(customs);
    } catch {}
    setMyLoading(false);
  }, []);

  const loadRecommended = useCallback(async () => {
    if (!userId) return;
    setRecLoading(true);
    try {
      const [profRes, customs, savedAnswersRaw, savedPlanRaw] = await Promise.all([
        apiClient.get(`/api/user-profile/${userId}`),
        getCustomPlans(userId),
        AsyncStorage.getItem(recAnswersKey(userId)).catch(() => null),
        AsyncStorage.getItem(recPlanKey(userId)).catch(() => null),
      ]);
      const profile = profRes.data || {};
      setRecProfile(profile);
      if (savedAnswersRaw) setRecAnswers(JSON.parse(savedAnswersRaw));
      if (savedPlanRaw) {
        const savedPlan = JSON.parse(savedPlanRaw);
        setRecPlan(savedPlan);
        const alreadySaved = customs.some((p) => p.id === savedPlan.id);
        setRecSaved(alreadySaved);
      } else {
        setRecPlan(null);
      }
    } catch {
      setRecProfile(null); setRecPlan(null);
    } finally {
      setRecLoading(false);
    }
  }, [userId]);

  async function generateAIPlanFn() {
    if (!recAnswers?.daysPerWeek || !recAnswers?.equipment || !recProfile) return;
    setRecAiLoading(true);
    setRecAiError(null);
    try {
      await AsyncStorage.setItem(recAnswersKey(userId), JSON.stringify(recAnswers));
      const plan = await generateAIPlan(recProfile, recAnswers);
      setRecPlan(plan);
      setRecSaved(false);
      setRecExpanded({});
      await AsyncStorage.setItem(recPlanKey(userId), JSON.stringify(plan));
    } catch (e) {
      setRecAiError(e.message || "Failed to generate plan. Please try again.");
    }
    setRecAiLoading(false);
  }

  async function saveAndSelectRec() {
    if (!recPlan || !userId) return;
    setRecSaving(true);
    try {
      await saveCustomPlan(recPlan, userId);
      await AsyncStorage.setItem(localActiveKey(userId), recPlan.id);
      const raw = await AsyncStorage.getItem(planHistoryKey(userId)).catch(() => "[]");
      const history = raw ? JSON.parse(raw) : [];
      const updated = [recPlan.id, ...history.filter((id) => id !== recPlan.id)].slice(0, 10);
      await AsyncStorage.setItem(planHistoryKey(userId), JSON.stringify(updated));
      setRecSaved(true);
    } catch {}
    setRecSaving(false);
  }

  useFocusEffect(useCallback(() => {
    if (source === "mine") loadMyPlans();
    if (source === "rec")  loadRecommended();
  }, [source, loadMyPlans, loadRecommended]));

  useEffect(() => {
    if (source === "mine") loadMyPlans();
    if (source === "rec")  loadRecommended();
  }, [source]);

  const allPlans = useMemo(() => {
    const base = [...LOCAL_PLANS, ...customPlans];
    return base.filter((p) =>
      (level === "All" || p.level === level) &&
      (goal === "All" || p.goal === goal || goal === "General Fitness" || p.goal === "Custom")
    );
  }, [level, goal, customPlans]);

  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(StackActions.popToTop())} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Workout Plans</Text>
        <View style={s.headerBtn} />
      </View>

      {/* Source tabs */}
      <TourTarget tourKey="plans_source_tabs">
        <View style={s.sourceTabs}>
          {[["all", "All Plans"], ["rec", "Recommended"], ["mine", "My Plans"]].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[s.sourceTab, source === key && s.sourceTabOn]}
              onPress={() => setSource(key)}
            >
              <Text style={[s.sourceTabText, source === key && s.sourceTabTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TourTarget>

      {/* ── ALL PLANS ──────────────────────────────────────────── */}
      {source === "all" && (
        <ScrollView contentContainerStyle={s.body}>
          <TourTarget tourKey="plans_filters">
            <View style={{ gap: spacing.sm }}>
              <View style={s.segWrap}>
                {LEVELS.map((x) => (
                  <TouchableOpacity key={x} style={[s.segBtn, level === x && s.segBtnOn]} onPress={() => setLevel(x)}>
                    <Text style={[s.segText, level === x && s.segTextOn]}>{x}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.goalWrap}>
                {GOALS.map((x) => (
                  <TouchableOpacity key={x} style={[s.goalBtn, goal === x && s.goalBtnOn]} onPress={() => setGoal(x)}>
                    <Text style={[s.goalText, goal === x && s.goalTextOn]}>{x}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TourTarget>

          <TourTarget tourKey="plans_cards">
            <View>
              {allPlans.length === 0 ? (
                <Text style={s.empty}>No plans match these filters.</Text>
              ) : allPlans.map((p) => (
                <PlanCard key={p.id} plan={p} colors={colors} s={s} onPress={() => navigation.navigate("WorkoutPlanDetail", { planId: p.id })} />
              ))}
            </View>
          </TourTarget>
        </ScrollView>
      )}

      {/* ── RECOMMENDED ────────────────────────────────────────── */}
      {source === "rec" && (
        <ScrollView contentContainerStyle={s.body}>
          {recLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
          ) : !recProfile || (!recProfile.experienceLevel && !recProfile.activityLevel && !(recProfile.aims?.length)) ? (
            <View style={s.recEmptyCard}>
              <Ionicons name="person-circle-outline" size={48} color={colors.textSecondary} />
              <Text style={s.recEmptyTitle}>Complete your profile first</Text>
              <Text style={s.recEmptySub}>
                Set your experience level, activity level, and aims in your profile to get a personalised workout plan.
              </Text>
              <TouchableOpacity style={[s.recActionBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate("Profile")}>
                <Text style={s.recActionBtnText}>Go to Profile</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Profile summary */}
              <View style={s.recSummaryCard}>
                <View style={s.recSummaryHeader}>
                  <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
                  <Text style={s.recSummaryTitle}>Your profile</Text>
                </View>
                <View style={s.recBadgeRow}>
                  {recProfile.experienceLevel ? (
                    <View style={[s.recBadge, { backgroundColor: (LEVEL_COLORS[recProfile.experienceLevel] || colors.primary) + "22" }]}>
                      <Text style={[s.recBadgeText, { color: LEVEL_COLORS[recProfile.experienceLevel] || colors.primary }]}>
                        {recProfile.experienceLevel}
                      </Text>
                    </View>
                  ) : null}
                  {recProfile.activityLevel ? (
                    <View style={[s.recBadge, { backgroundColor: colors.primary + "22" }]}>
                      <Text style={[s.recBadgeText, { color: colors.primary }]}>{recProfile.activityLevel} Activity</Text>
                    </View>
                  ) : null}
                </View>
                {recProfile.aims?.length > 0 && (
                  <View style={s.recAimsRow}>
                    {recProfile.aims.slice(0, 5).map((aim) => (
                      <View key={aim} style={s.recAimChip}>
                        <Text style={s.recAimText}>{aim}</Text>
                      </View>
                    ))}
                    {recProfile.aims.length > 5 && (
                      <View style={s.recAimChip}>
                        <Text style={s.recAimText}>+{recProfile.aims.length - 5} more</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Preferences / question card */}
              <View style={s.questionCard}>
                <View style={s.questionHeader}>
                  <Ionicons name="options-outline" size={18} color={colors.primary} />
                  <Text style={s.questionTitle}>Plan preferences</Text>
                </View>

                <Text style={s.questionLabel}>Days per week</Text>
                <View style={s.daysRow}>
                  {[1, 2, 3, 4, 5, 6].map((d) => {
                    const active = recAnswers?.daysPerWeek === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[s.dayBtn, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => setRecAnswers((p) => ({ ...(p || {}), daysPerWeek: d }))}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.dayBtnText, { color: active ? "#fff" : colors.text }]}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[s.questionLabel, { marginTop: spacing.md }]}>Equipment access</Text>
                {EQUIPMENT_OPTIONS.map((eq) => {
                  const active = recAnswers?.equipment === eq;
                  return (
                    <TouchableOpacity
                      key={eq}
                      style={[s.eqBtn, active && { backgroundColor: colors.primary + "18", borderColor: colors.primary }]}
                      onPress={() => setRecAnswers((p) => ({ ...(p || {}), equipment: eq }))}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={EQUIPMENT_ICONS[eq]} size={18} color={active ? colors.primary : colors.textSecondary} />
                      <Text style={[s.eqBtnText, { color: active ? colors.primary : colors.text }]}>{eq}</Text>
                      {active && <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginLeft: "auto" }} />}
                    </TouchableOpacity>
                  );
                })}

                {recAiError ? (
                  <View style={s.aiErrorCard}>
                    <Ionicons name="warning-outline" size={18} color="#ef4444" />
                    <Text style={s.aiErrorText}>{recAiError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[
                    s.generateBtn,
                    { backgroundColor: colors.primary, opacity: recAnswers?.daysPerWeek && recAnswers?.equipment ? 1 : 0.4 },
                  ]}
                  onPress={generateAIPlanFn}
                  disabled={!recAnswers?.daysPerWeek || !recAnswers?.equipment || recAiLoading}
                  activeOpacity={0.8}
                >
                  {recAiLoading ? (
                    <>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={s.generateBtnText}>Creating your plan...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color="#fff" />
                      <Text style={s.generateBtnText}>{recPlan ? "Regenerate Plan" : "Generate My Plan"}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Generated plan */}
              {recPlan && !recAiLoading && (
                <>
                  {/* AI badge */}
                  <View style={s.aiBadgeRow}>
                    <Ionicons name="sparkles" size={13} color={colors.primary} />
                    <Text style={s.aiBadgeText}>AI-generated plan</Text>
                    {recPlan.generatedAt ? (
                      <Text style={s.aiBadgeDate}>{new Date(recPlan.generatedAt).toLocaleDateString()}</Text>
                    ) : null}
                  </View>

                  {/* Plan card */}
                  <View style={s.recPlanCard}>
                    <View style={[s.planAccent, { backgroundColor: GOAL_COLORS[recPlan.goal] || colors.primary }]} />
                    <View style={s.planCardInner}>
                      <View style={s.planTitleRow}>
                        <Text style={s.planTitle}>{recPlan.name}</Text>
                        <View style={[s.goalBadge, { backgroundColor: (GOAL_COLORS[recPlan.goal] || colors.primary) + "22" }]}>
                          <Text style={[s.goalBadgeText, { color: GOAL_COLORS[recPlan.goal] || colors.primary }]}>{recPlan.goal}</Text>
                        </View>
                      </View>
                      <Text style={s.planSub}>{recPlan.description}</Text>
                      <View style={s.metaTags}>
                        {[recPlan.level, `${recPlan.daysPerWeek} days/wk`, `${recPlan.sessions.length} sessions`].map((tag) => (
                          <View key={tag} style={[s.metaTag, tag === recPlan.level && { backgroundColor: (LEVEL_COLORS[recPlan.level] || colors.primary) + "18" }]}>
                            <Text style={[s.metaTagText, tag === recPlan.level && { color: LEVEL_COLORS[recPlan.level] || colors.primary }]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Sessions list */}
                  <View style={s.recSessionsCard}>
                    <Text style={s.recSessionsTitle}>Sessions</Text>
                    {recPlan.sessions.map((sess, si) => {
                      const isOpen = !!recExpanded[si];
                      return (
                        <View key={si} style={s.recSessBlock}>
                          <TouchableOpacity style={s.recSessRow} onPress={() => setRecExpanded((p) => ({ ...p, [si]: !p[si] }))}>
                            <View style={[s.recSessNum, { backgroundColor: (GOAL_COLORS[recPlan.goal] || colors.primary) + "22" }]}>
                              <Text style={[s.recSessNumText, { color: GOAL_COLORS[recPlan.goal] || colors.primary }]}>{si + 1}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.recSessName}>{sess.title}</Text>
                              <Text style={s.recSessMeta}>{sess.exercises.length} exercises</Text>
                            </View>
                            <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
                          </TouchableOpacity>
                          {isOpen && (
                            <View style={s.recExList}>
                              {sess.exercises.map((ex, ei) => (
                                <View key={ei} style={s.recExRow}>
                                  <View style={[s.recExDot, { backgroundColor: GOAL_COLORS[recPlan.goal] || colors.primary }]} />
                                  <Text style={s.recExName} numberOfLines={1}>{ex.name}</Text>
                                  <Text style={s.recExMeta}>{ex.sets}×{ex.reps}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {/* CTA */}
                  {recSaved ? (
                    <View style={s.recSavedBanner}>
                      <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                      <Text style={s.recSavedText}>Plan saved and set as active!</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[s.recActionBtn, { backgroundColor: GOAL_COLORS[recPlan.goal] || colors.primary }]}
                      onPress={saveAndSelectRec}
                      disabled={recSaving}
                    >
                      {recSaving ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                          <Text style={s.recActionBtnText}>Save & Select this Plan</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── MY PLANS ───────────────────────────────────────────── */}
      {source === "mine" && (
        <ScrollView contentContainerStyle={s.body}>
          {myLoading && <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />}

          <TouchableOpacity style={s.createBtn} onPress={() => navigation.navigate("CustomPlanBuilder")}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={s.createBtnText}>Create Custom Plan</Text>
          </TouchableOpacity>

          {/* Currently selected plan */}
          <Text style={s.sectionHeader}>Current Plan</Text>
          <TourTarget tourKey="plans_active">
          {activePlan ? (
            <View style={[s.activePlanCard, { borderColor: colors.primary }]}>
              <View style={s.activePlanBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                <Text style={[s.activePlanBadgeText, { color: colors.primary }]}>Active</Text>
              </View>
              <Text style={s.activePlanName}>{activePlan.name}</Text>
              <Text style={s.activePlanMeta}>{activePlan.level} · {activePlan.goal} · {activePlan.daysPerWeek} days/week</Text>
              <Text style={s.activePlanDesc} numberOfLines={2}>{activePlan.description}</Text>
              <TouchableOpacity
                style={[s.viewBtnSmall, { borderColor: colors.primary }]}
                onPress={() => navigation.navigate("WorkoutPlanDetail", { planId: activePlan.id })}
              >
                <Text style={[s.viewBtnSmallText, { color: colors.primary }]}>View Plan</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.emptyCard}>
              <Ionicons name="clipboard-outline" size={28} color={colors.textSecondary} />
              <Text style={s.empty}>No plan selected yet.</Text>
              <Text style={s.emptySub}>Browse "All Plans" and tap "Select this plan" to get started.</Text>
            </View>
          )}
          </TourTarget>

          {/* Custom plans */}
          {customPlans.length > 0 && (
            <>
              <Text style={s.sectionHeader}>My Custom Plans</Text>
              {customPlans.map((p) => (
                <PlanCard key={p.id} plan={p} colors={colors} s={s}
                  onPress={() => navigation.navigate("WorkoutPlanDetail", { planId: p.id })}
                  onEdit={() => navigation.navigate("CustomPlanBuilder", { editPlan: p })}
                />
              ))}
            </>
          )}

          {/* History */}
          {historyPlans.length > 0 && (
            <>
              <Text style={s.sectionHeader}>Previously Used</Text>
              {historyPlans.map((p) => (
                <PlanCard key={p.id} plan={p} colors={colors} s={s} onPress={() => navigation.navigate("WorkoutPlanDetail", { planId: p.id })} />
              ))}
            </>
          )}

          {!myLoading && !activePlan && customPlans.length === 0 && historyPlans.length === 0 && (
            <View style={s.emptyCard}>
              <Text style={s.emptySub}>Select or create plans to see them here.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PlanCard({ plan, colors, s, onPress, onEdit }) {
  const goalColor  = GOAL_COLORS[plan.goal]  || colors.primary;
  const levelColor = LEVEL_COLORS[plan.level] || colors.textSecondary;
  return (
    <View style={s.planCard}>
      <View style={[s.planAccent, { backgroundColor: goalColor }]} />
      <View style={s.planCardInner}>
        <View style={s.planTitleRow}>
          <Text style={s.planTitle}>{plan.name}</Text>
          <View style={[s.goalBadge, { backgroundColor: goalColor + "22" }]}>
            <Text style={[s.goalBadgeText, { color: goalColor }]}>{plan.goal}</Text>
          </View>
        </View>
        <Text style={s.planSub} numberOfLines={2}>{plan.description}</Text>
        <View style={s.metaTags}>
          {[plan.level, `${plan.daysPerWeek} days/wk`, `${plan.sessions.length} sessions`].map((tag) => (
            <View key={tag} style={[s.metaTag, tag === plan.level && { backgroundColor: levelColor + "18" }]}>
              <Text style={[s.metaTagText, tag === plan.level && { color: levelColor }]}>{tag}</Text>
            </View>
          ))}
        </View>
        <View style={s.cardBtnRow}>
          <TouchableOpacity style={[s.viewBtn, { backgroundColor: goalColor }]} onPress={onPress}>
            <Ionicons name="eye-outline" size={15} color="#fff" />
            <Text style={s.viewBtnText}>View plan</Text>
          </TouchableOpacity>
          {onEdit && (
            <TouchableOpacity style={[s.editBtn, { borderColor: goalColor }]} onPress={onEdit}>
              <Ionicons name="pencil-outline" size={14} color={goalColor} />
              <Text style={[s.editBtnText, { color: goalColor }]}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors, isDark) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerBtn: { width: 40 },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    sourceTabs: { flexDirection: "row", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    sourceTab: { flex: 1, paddingVertical: 12, alignItems: "center" },
    sourceTabOn: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    sourceTabText: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.textSecondary },
    sourceTabTextOn: { color: colors.primary },
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xs },
    segWrap: { flexDirection: "row", gap: spacing.sm },
    segBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.md, alignItems: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    segBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    segText: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.textSecondary },
    segTextOn: { color: "#fff" },
    goalWrap: { gap: spacing.sm },
    goalBtn: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    goalBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    goalText: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.textSecondary },
    goalTextOn: { color: "#fff" },
    empty: { color: colors.textSecondary, textAlign: "center", fontSize: font.sm },
    emptySub: { color: colors.textSecondary, fontSize: font.sm, textAlign: "center", opacity: 0.7, marginTop: 4 },
    planCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden", flexDirection: "row",
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    planAccent: { width: 5 },
    planCardInner: { flex: 1, padding: spacing.lg, gap: spacing.sm },
    planTitleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
    planTitle: { fontSize: font.base, fontWeight: font.bold, color: colors.text, flex: 1 },
    goalBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
    goalBadgeText: { fontSize: 11, fontWeight: "700" },
    planSub: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 18 },
    metaTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    metaTag: { backgroundColor: colors.background, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
    metaTagText: { fontSize: 11, color: colors.textSecondary },
    cardBtnRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
    viewBtn: {
      borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.md,
      flexDirection: "row", alignItems: "center", gap: 6,
    },
    viewBtnText: { color: "#fff", fontWeight: font.semiBold, fontSize: font.sm },
    editBtn: {
      borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.md,
      flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5,
    },
    editBtnText: { fontWeight: font.semiBold, fontSize: font.sm },
    // My Plans
    sectionHeader: { fontSize: font.base, fontWeight: font.bold, color: colors.text, marginTop: spacing.sm },
    createBtn: {
      backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 14,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
    },
    createBtnText: { color: "#fff", fontWeight: font.bold, fontSize: font.base },
    activePlanCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
      borderWidth: 2,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    activePlanBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    activePlanBadgeText: { fontSize: 12, fontWeight: "700" },
    activePlanName: { fontSize: font.xl, fontWeight: font.bold, color: colors.text },
    activePlanMeta: { fontSize: font.sm, color: colors.textSecondary },
    activePlanDesc: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 18 },
    viewBtnSmall: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, marginTop: 4 },
    viewBtnSmallText: { fontSize: font.sm, fontWeight: font.semiBold },
    emptyCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl,
      alignItems: "center", gap: 8,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    // ── Recommended tab ────────────────────────────────────────────────────────
    recEmptyCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl,
      alignItems: "center", gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    recEmptyTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.text, textAlign: "center" },
    recEmptySub: { fontSize: font.sm, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
    recSummaryCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    recSummaryHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    recSummaryTitle: { fontSize: font.base, fontWeight: font.bold, color: colors.text },
    recBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    recBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
    recBadgeText: { fontSize: font.sm, fontWeight: font.bold },
    recAimsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    recAimChip: { backgroundColor: colors.background, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: colors.border },
    recAimText: { fontSize: 11, color: colors.textSecondary },
    recRationaleList: { gap: 4, marginTop: 2 },
    recRationaleLine: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    recRationaleText: { fontSize: font.sm, color: colors.textSecondary, flex: 1, lineHeight: 18 },
    recPlanCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden", flexDirection: "row",
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    recSessionsCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    recSessionsTitle: { fontSize: font.base, fontWeight: font.bold, color: colors.text, marginBottom: 4 },
    recSessBlock: { borderTopWidth: 1, borderTopColor: colors.border },
    recSessRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
    recSessNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    recSessNumText: { fontSize: 12, fontWeight: font.bold },
    recSessName: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.text },
    recSessMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    recExList: { paddingLeft: 38, paddingBottom: spacing.sm, gap: 4 },
    recExRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    recExDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
    recExName: { flex: 1, fontSize: font.sm, color: colors.text },
    recExMeta: { fontSize: 11, color: colors.textSecondary, fontWeight: font.semiBold },
    recActionBtn: {
      borderRadius: radius.lg, paddingVertical: 15, flexDirection: "row",
      alignItems: "center", justifyContent: "center", gap: 8,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
    },
    recActionBtnText: { color: "#fff", fontWeight: font.bold, fontSize: font.base },
    recSavedBanner: {
      backgroundColor: isDark ? "rgba(74,222,128,0.12)" : "#dcfce7",
      borderRadius: radius.lg, padding: spacing.lg,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    },
    recSavedText: { fontSize: font.base, fontWeight: font.semiBold, color: isDark ? "#4ade80" : "#15803d" },
    // ── AI question card ───────────────────────────────────────────────────────
    questionCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    questionHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 4 },
    questionTitle: { fontSize: font.base, fontWeight: font.bold, color: colors.text },
    questionLabel: { fontSize: font.sm, fontWeight: font.semiBold, color: colors.textSecondary },
    daysRow: { flexDirection: "row", gap: 8 },
    dayBtn: {
      flex: 1, height: 44, alignItems: "center", justifyContent: "center",
      borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.background,
    },
    dayBtnText: { fontSize: font.base, fontWeight: font.bold },
    eqBtn: {
      flexDirection: "row", alignItems: "center", gap: 10,
      padding: spacing.md, borderRadius: radius.md,
      borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.background,
    },
    eqBtnText: { fontSize: font.sm, fontWeight: font.semiBold, flex: 1 },
    generateBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      borderRadius: radius.lg, paddingVertical: 15, marginTop: spacing.sm,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
    },
    generateBtnText: { color: "#fff", fontWeight: font.bold, fontSize: font.base },
    aiErrorCard: {
      flexDirection: "row", alignItems: "flex-start", gap: 8,
      backgroundColor: isDark ? "rgba(239,68,68,0.12)" : "#fee2e2",
      borderRadius: radius.md, padding: spacing.md,
    },
    aiErrorText: { flex: 1, fontSize: font.sm, color: isDark ? "#f87171" : "#b91c1c", lineHeight: 18 },
    aiBadgeRow: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 4,
    },
    aiBadgeText: { fontSize: 12, fontWeight: "700", color: colors.primary },
    aiBadgeDate: { fontSize: 11, color: colors.textSecondary, marginLeft: "auto" },
  });
}
