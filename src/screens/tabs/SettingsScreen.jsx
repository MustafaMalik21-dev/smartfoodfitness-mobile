import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { syncLocalNotifications } from "../../utils/localNotifications";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";
import TourTarget from "../../tour/TourTarget";
import { useTour } from "../../tour/TourContext";
import apiClient from "../../api/apiClient";

const LS_KEY = "sff_settings_v1";
const DEFAULTS = {
  units: { weight: "kg", height: "ft" },
  notifications: { workouts: true, food: true, streak: true },
};

async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed) return DEFAULTS;
    return {
      units: { ...DEFAULTS.units, ...(parsed.units || {}) },
      notifications: { ...DEFAULTS.notifications, ...(parsed.notifications || {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

async function saveSettings(s) {
  try { await AsyncStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

function PillTabs({ options, value, onChange, colors }) {
  const st = useMemo(() => pillStyles(colors), [colors]);
  return (
    <View style={st.wrap}>
      {options.map((opt) => (
        <TouchableOpacity key={opt.value} style={[st.btn, value === opt.value && st.btnOn]} onPress={() => onChange(opt.value)}>
          <Text style={[st.text, value === opt.value && st.textOn]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function pillStyles(colors) {
  return StyleSheet.create({
    wrap: { flexDirection: "row", gap: 6 },
    btn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
    btnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    text: { fontSize: font.sm, color: colors.textSecondary },
    textOn: { color: "#fff", fontWeight: font.semiBold },
  });
}

function ToggleRow({ label, value, onChange, colors }) {
  const s = useMemo(() => toggleStyles(colors), [colors]);
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
    </View>
  );
}

function toggleStyles(colors) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
    label: { fontSize: font.base, color: colors.text },
  });
}

export default function SettingsScreen({ navigation }) {
  const { colors, isDark, toggleTheme, resetTheme } = useTheme();
  const { logout, auth } = useAuth();
  const { registerScroll, resetTour } = useTour();
  const userId = auth?.userId;
  const scrollRef = useRef(null);
  useEffect(() => { registerScroll("Settings", scrollRef); }, []);
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  // Privacy settings (server-side)
  const [privacy, setPrivacy] = useState({ profileVisibility: "friends", shareWeight: true, shareActivity: true });
  const [privacySaving, setPrivacySaving] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => { setSettings(s); setLoaded(true); });
  }, []);

  useEffect(() => {
    if (!userId) return;
    apiClient.get(`/api/user-profile/${userId}`)
      .then(res => {
        if (res.data) setPrivacy({
          profileVisibility: res.data.profileVisibility || "friends",
          shareWeight:   res.data.shareWeight  ?? true,
          shareActivity: res.data.shareActivity ?? true,
        });
      }).catch(() => {});
  }, [userId]);

  async function savePrivacy(next) {
    setPrivacy(next);
    setPrivacySaving(true);
    try {
      await apiClient.put(`/api/user-profile/${userId}/privacy`, next);
    } catch {}
    finally { setPrivacySaving(false); }
  }

  function update(next) {
    setSettings(next);
    saveSettings(next);
  }

  const setUnit = (k, v) => update({ ...settings, units: { ...settings.units, [k]: v } });

  const setNotifications = async (k, v) => {
    const next = { ...settings, notifications: { ...settings.notifications, [k]: v } };
    update(next);
    const granted = await syncLocalNotifications(next.notifications);
    if (!granted && v) {
      Alert.alert(
        "Notifications Blocked",
        "Please enable notifications for this app in your device Settings to receive reminders.",
      );
    }
  };

  const s = useMemo(() => makeStyles(colors), [colors]);

  if (!loaded) return null;

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={s.headerBtn} />
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        <TourTarget tourKey="settings_home">
          <View style={s.card}>
            <Text style={s.cardTitle}>Appearance</Text>
            <View style={s.prefRow}>
              <View style={s.prefLabelRow}>
                <Ionicons name={isDark ? "moon" : "sunny-outline"} size={18} color={isDark ? "#818cf8" : colors.warning} />
                <Text style={s.prefLabel}>Dark Mode</Text>
              </View>
              <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
            </View>
          </View>
        </TourTarget>

        <View style={s.card}>
          <Text style={s.cardTitle}>Units</Text>
          <View style={s.prefRow}>
            <Text style={s.prefLabel}>Weight</Text>
            <PillTabs
              colors={colors}
              value={settings.units.weight}
              onChange={(v) => setUnit("weight", v)}
              options={[{ label: "Kg", value: "kg" }, { label: "Lbs", value: "lbs" }]}
            />
          </View>
          <View style={s.prefRow}>
            <Text style={s.prefLabel}>Height</Text>
            <PillTabs
              colors={colors}
              value={settings.units.height}
              onChange={(v) => setUnit("height", v)}
              options={[{ label: "Ft", value: "ft" }, { label: "M", value: "m" }]}
            />
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Notifications</Text>
          <ToggleRow colors={colors} label="Workouts" value={settings.notifications.workouts} onChange={(v) => setNotifications("workouts", v)} />
          <ToggleRow colors={colors} label="Food Reminders" value={settings.notifications.food} onChange={(v) => setNotifications("food", v)} />
          <ToggleRow colors={colors} label="Streak Alerts" value={settings.notifications.streak} onChange={(v) => setNotifications("streak", v)} />
        </View>

        {/* Privacy & Social */}
        <View style={s.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
              <Text style={s.cardTitle}>Privacy &amp; Social</Text>
            </View>
            {privacySaving && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          <Text style={s.sectionLabel}>Profile visibility</Text>
          <PillTabs
            colors={colors}
            value={privacy.profileVisibility}
            onChange={v => savePrivacy({ ...privacy, profileVisibility: v })}
            options={[
              { label: "Public",  value: "public"  },
              { label: "Friends", value: "friends" },
              { label: "Private", value: "private" },
            ]}
          />
          <Text style={[s.settingNote, { color: colors.textSecondary }]}>
            {privacy.profileVisibility === "public"  && "Anyone can find and view your profile."}
            {privacy.profileVisibility === "friends" && "Only accepted friends can view your profile."}
            {privacy.profileVisibility === "private" && "Your profile is hidden from everyone."}
          </Text>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />

          <ToggleRow colors={colors} label="Share weight with friends"
            value={privacy.shareWeight}
            onChange={v => savePrivacy({ ...privacy, shareWeight: v })} />
          <Text style={[s.settingNote, { color: colors.textSecondary }]}>
            Friends can see your latest weight and BMI
          </Text>

          <ToggleRow colors={colors} label="Share activity with friends"
            value={privacy.shareActivity}
            onChange={v => savePrivacy({ ...privacy, shareActivity: v })} />
          <Text style={[s.settingNote, { color: colors.textSecondary }]}>
            Friends can see your weekly workout count
          </Text>
        </View>

        <TouchableOpacity style={s.replayBtn} onPress={resetTour}>
          <Ionicons name="play-circle-outline" size={18} color={colors.primary} />
          <Text style={[s.replayText, { color: colors.primary }]}>Replay App Guide</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.logoutBtn} onPress={() => { resetTheme(); logout(); }}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>
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
    headerBtn: { width: 40, alignItems: "flex-start" },
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xs },
    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    cardTitle:   { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    sectionLabel:{ fontSize: font.sm, fontWeight: "700", color: colors.textSecondary, marginBottom: 8, marginTop: 4 },
    settingNote: { fontSize: 11, marginTop: 3, marginBottom: 6, lineHeight: 16 },
    prefRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    prefLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    prefLabel: { fontSize: font.base, color: colors.text },
    replayBtn: {
      borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.lg,
      paddingVertical: 14, alignItems: "center", marginTop: spacing.sm,
      flexDirection: "row", justifyContent: "center", gap: 8,
    },
    replayText: { fontSize: font.base, fontWeight: font.semiBold },
    logoutBtn: {
      borderWidth: 1.5, borderColor: colors.error, borderRadius: radius.lg,
      paddingVertical: 14, alignItems: "center", marginTop: spacing.sm,
      flexDirection: "row", justifyContent: "center", gap: 8,
    },
    logoutText: { color: colors.error, fontSize: font.lg, fontWeight: font.semiBold },
  });
}
