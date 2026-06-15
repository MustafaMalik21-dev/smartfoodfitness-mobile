import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

const GUIDE_ITEMS = [
  { key: "dashboard", title: "Dashboard", icon: "home-outline", text: "Summary of calories and macros, plus quick access to what you use most.", tip: "Check your targets and today's progress first." },
  { key: "fitness", title: "Fitness", icon: "barbell-outline", text: "Access page for all fitness related features including workouts and plans.", tip: "Open Workout Plans and pick a plan to follow." },
  { key: "tracking", title: "Tracking", icon: "stats-chart-outline", text: "Shows detailed tracking of both food and fitness progress.", tip: "Review trends weekly to stay consistent." },
  { key: "food", title: "Food", icon: "nutrition-outline", text: "Log meals, check calories, and explore recipes.", tip: "Try the Recipes page for quick meal ideas." },
  { key: "settings", title: "Settings", icon: "settings-outline", text: "Customise your experience and app preferences.", tip: "Enable Dark Mode for a nicer look." },
  { key: "profile", title: "Profile", icon: "person-outline", text: "View and manage all your personal data and aims.", tip: "Keep your details updated for better accuracy." },
];

export default function OnboardingGuideScreen({ navigation }) {
  const { colors } = useTheme();
  const { auth, setAuth } = useAuth();
  const userId = auth?.userId ?? null;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function completeGuide() {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await apiClient.put(`/api/user-profile/${userId}`, {
        email: auth?.email ?? null,
        displayName: auth?.displayName ?? null,
        onboardingComplete: true,
      });
      setAuth({ ...auth, onboardingComplete: true });
    } catch (e) {
      setErr(String(e?.response?.data?.message || "Could not finish setup. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.appTitle}>Smart Food & Fitness</Text>
        <View style={s.panel}>
          <Text style={s.h1}>Quick guide</Text>
          <Text style={s.sub}>Here's what each page does so navigation feels easier.</Text>

          {err ? <View style={s.errBox}><Text style={s.errText}>{err}</Text></View> : null}

          {GUIDE_ITEMS.map((x) => (
            <View key={x.key} style={s.card}>
              <View style={s.iconWrap}>
                <Ionicons name={x.icon} size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{x.title}</Text>
                <Text style={s.cardDesc}>{x.text}</Text>
                <Text style={s.cardTip}>Tip: {x.tip}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={[s.btn, busy && s.btnDisabled]} onPress={completeGuide} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Start using the app</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: spacing.xxl },
    appTitle: { fontSize: font.xl, fontWeight: font.bold, color: colors.primary, textAlign: "center", marginBottom: spacing.xxl, marginTop: spacing.lg },
    panel: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xxl, gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
    },
    h1: { fontSize: font.xxl, fontWeight: font.bold, color: colors.text },
    sub: { fontSize: font.md, color: colors.textSecondary, marginBottom: spacing.sm },
    errBox: { backgroundColor: "#fee2e2", borderRadius: radius.sm, padding: spacing.md },
    errText: { color: "#b91c1c", fontSize: font.sm },
    card: { flexDirection: "row", gap: spacing.md, padding: spacing.md, backgroundColor: colors.background, borderRadius: radius.md, alignItems: "flex-start" },
    iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.insightBg, alignItems: "center", justifyContent: "center" },
    cardTitle: { fontSize: font.base, fontWeight: font.bold, color: colors.text, marginBottom: 2 },
    cardDesc: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 2 },
    cardTip: { fontSize: font.sm, color: colors.primary, fontStyle: "italic" },
    btn: {
      backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: "center", marginTop: spacing.sm,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: "#fff", fontSize: font.lg, fontWeight: font.semiBold },
  });
}
