import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import TourTarget from "../../tour/TourTarget";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { postNotification } from "../../utils/notificationService";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";
import { AIM_CATEGORIES, MAX_AIMS, getAimColor } from "../../data/aims";

const AVATAR_KEY = "sff_avatar_uri";
const BG_KEY = "sff_profile_bg";

const BACKGROUNDS = [
  { key: "blue",      label: "Blue",      color: "#0b84ff" },
  { key: "ocean",     label: "Ocean",     color: "#06b6d4" },
  { key: "forest",    label: "Forest",    color: "#16a34a" },
  { key: "teal",      label: "Teal",      color: "#0d9488" },
  { key: "sunset",    label: "Sunset",    color: "#f97316" },
  { key: "coral",     label: "Coral",     color: "#ef4444" },
  { key: "purple",    label: "Purple",    color: "#7c3aed" },
  { key: "pink",      label: "Pink",      color: "#db2777" },
  { key: "gold",      label: "Gold",      color: "#d97706" },
  { key: "rose",      label: "Rose",      color: "#e11d48" },
  { key: "midnight",  label: "Midnight",  color: "#1e1b4b" },
  { key: "graphite",  label: "Graphite",  color: "#374151" },
];

function toNumOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function unitLabel(u) {
  const x = String(u || "").toLowerCase();
  if (x === "kg") return "Kg";
  if (x === "lbs" || x === "lb") return "Lbs";
  if (x === "ft") return "Ft";
  if (x === "m") return "M";
  return u;
}

function formatHeight(heightValue, heightUnit) {
  const v = Number(heightValue);
  const u = String(heightUnit || "").toLowerCase();
  if (!Number.isFinite(v)) return "—";
  if (u === "ft") {
    const feet = Math.floor(v);
    let inches = Math.round((v - feet) * 12);
    let f = feet;
    if (inches === 12) { f++; inches = 0; }
    return `${f}'${inches}"`;
  }
  if (u === "m") return `${v.toFixed(2)} m`;
  return `${v} ${unitLabel(u)}`;
}

function BgSwatch({ bg, selected, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[swatchS.wrap, selected && { borderColor: "#fff", borderWidth: 3 }]} activeOpacity={0.8}>
      <View style={[swatchS.circle, { backgroundColor: bg.color }]}>
        {selected && <Ionicons name="checkmark" size={18} color="#fff" />}
      </View>
      <Text style={swatchS.label}>{bg.label}</Text>
    </TouchableOpacity>
  );
}
const swatchS = StyleSheet.create({
  wrap: {
    alignItems: "center", gap: 6, padding: 8,
    borderRadius: 14, borderWidth: 3, borderColor: "transparent",
    minWidth: 64,
  },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, color: "#fff", fontWeight: "600", textAlign: "center" },
});

// Segmented button picker — replaces scroll-wheel Picker for small option sets
function SegmentedPicker({ options, value, onChange, colors }) {
  return (
    <View style={[segS.container, { borderColor: colors.border, backgroundColor: colors.background }]}>
      {options.map((opt, i) => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.75}
            style={[
              segS.btn,
              i > 0 && [segS.btnBorder, { borderLeftColor: colors.border }],
              active && { backgroundColor: colors.primary },
            ]}
          >
            <Text style={[segS.btnText, { color: active ? "#fff" : colors.text }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const segS = StyleSheet.create({
  container: { flexDirection: "row", borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  btn: { flex: 1, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  btnBorder: { borderLeftWidth: StyleSheet.hairlineWidth },
  btnText: { fontSize: 15, fontWeight: "600" },
});

export default function ProfileScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { auth } = useAuth();
  const userId = auth?.userId;

  const [profile, setProfile] = useState(null);
  const [streak, setStreak] = useState(null);
  const [latestWeight, setLatestWeight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [aims, setAims] = useState([]);
  const [aimsOpen, setAimsOpen] = useState(false);
  const [aimCategory, setAimCategory] = useState(AIM_CATEGORIES[0].key);
  const [errorMsg, setErrorMsg] = useState("");
  const [avatarUri, setAvatarUri] = useState(null);
  const [bgKey, setBgKey] = useState("blue");
  const [bgModalOpen, setBgModalOpen] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  async function loadAll() {
    try {
      setLoading(true); setErrorMsg("");
      const [pRes, sRes, wRes] = await Promise.all([
        apiClient.get(`/api/user-profile/${userId}`),
        apiClient.get(`/api/workout-logs/user/${userId}/streak`, { params: { timezone: "Europe/London" } }),
        apiClient.get(`/api/weight-entries/user/${userId}/latest`).catch(() => ({ data: null })),
      ]);
      setProfile(pRes.data);
      setStreak(sRes.data);
      setLatestWeight(wRes.data);
      setAims(Array.isArray(pRes.data?.aims) ? pRes.data.aims : []);
      setIsEditing(false); setDraft(null);

      const savedAvatar = await AsyncStorage.getItem(`${AVATAR_KEY}_${userId}`);
      if (savedAvatar) setAvatarUri(savedAvatar);
      const savedBg = await AsyncStorage.getItem(`${BG_KEY}_${userId}`);
      // Migrate old "default" key to "blue"
      if (savedBg && savedBg !== "default") setBgKey(savedBg);

      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch {
      setErrorMsg("Could not load profile.");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (userId) loadAll(); }, [userId]);

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      await AsyncStorage.setItem(`${AVATAR_KEY}_${userId}`, uri);
    }
  }

  async function selectBg(key) {
    setBgKey(key);
    await AsyncStorage.setItem(`${BG_KEY}_${userId}`, key);
  }

  function startEdit() {
    if (!profile) return;
    const lwVal = latestWeight?.weightValue ?? null;
    const lwUnit = latestWeight?.weightUnit ?? null;
    const hv = Number(profile.heightValue);
    const hUnit = (profile.heightUnit ?? "ft").toLowerCase();

    // Split stored decimal height back into ft+in or m+cm
    let heightFt = "", heightIn = "", heightM = "", heightCm = "";
    if (Number.isFinite(hv) && hv > 0) {
      if (hUnit === "ft") {
        heightFt = String(Math.floor(hv));
        heightIn = String(Math.round((hv - Math.floor(hv)) * 12));
      } else {
        heightM  = String(Math.floor(hv));
        heightCm = String(Math.round((hv - Math.floor(hv)) * 100));
      }
    }

    setDraft({
      displayName: profile.displayName ?? "",
      age: String(profile.age ?? ""),
      gender: profile.gender ?? "",
      activityLevel: profile.activityLevel ?? "",
      heightUnit: hUnit,
      heightFt, heightIn, heightM, heightCm,
      weightValue: String(lwVal ?? profile.weightValue ?? ""),
      weightUnit: lwUnit ?? profile.weightUnit ?? "kg",
      experienceLevel: profile.experienceLevel ?? "",
    });
    setIsEditing(true); setErrorMsg("");
  }

  function cancelEdit() {
    setIsEditing(false); setDraft(null); setErrorMsg("");
  }

  async function saveEdit() {
    if (!draft) return;
    const draftWeightValue = toNumOrNull(draft.weightValue);
    const weightChanged = draftWeightValue !== null && (latestWeight?.weightValue == null || Number(draftWeightValue) !== Number(latestWeight.weightValue));

    // Reconstruct single decimal heightValue from split fields
    let heightValueToSend = null;
    if (draft.heightUnit === "ft") {
      const ft = Number(draft.heightFt) || 0;
      const inches = Number(draft.heightIn) || 0;
      if (ft > 0 || inches > 0) heightValueToSend = Math.round((ft + inches / 12) * 10) / 10;
    } else {
      const m  = Number(draft.heightM)  || 0;
      const cm = Number(draft.heightCm) || 0;
      if (m > 0 || cm > 0) heightValueToSend = Math.round((m + cm / 100) * 100) / 100;
    }

    try {
      setSaving(true); setErrorMsg("");
      if (weightChanged) {
        await apiClient.post("/api/weight-entries", { userId, weightValue: draftWeightValue, weightUnit: draft.weightUnit, recordedAt: new Date().toISOString() });
        setLatestWeight({ weightValue: draftWeightValue, weightUnit: draft.weightUnit });
        postNotification(userId, "general", "Weight updated! ⚖️", `${draftWeightValue} ${draft.weightUnit} saved from your profile.`);
      }
      const res = await apiClient.put(`/api/user-profile/${userId}`, {
        displayName: draft.displayName,
        age: toNumOrNull(draft.age),
        gender: draft.gender || null,
        activityLevel: draft.activityLevel || null,
        heightValue: heightValueToSend,
        heightUnit: draft.heightUnit || null,
        weightValue: draftWeightValue,
        weightUnit: draft.weightUnit,
        experienceLevel: draft.experienceLevel || null,
      });
      setProfile(res.data);
      setAims(Array.isArray(res.data?.aims) ? res.data.aims : aims);
      setIsEditing(false); setDraft(null);
    } catch { setErrorMsg("Update failed."); } finally { setSaving(false); }
  }

  async function toggleAim(label) {
    const exists = aims.includes(label);
    if (!exists && aims.length >= MAX_AIMS) return;
    const next = exists ? aims.filter((x) => x !== label) : [...aims, label];
    setAims(next);
    try { await apiClient.put(`/api/user-profile/${userId}/aims`, { aims: next }); } catch {}
  }

  function changeWeightUnit(newUnit) {
    if (!draft || newUnit === draft.weightUnit) return;
    const v = toNumOrNull(draft.weightValue);
    let converted = draft.weightValue;
    if (v != null) {
      if (newUnit === "lbs" && draft.weightUnit === "kg") converted = String(Math.round(v * 2.20462 * 10) / 10);
      else if (newUnit === "kg" && draft.weightUnit === "lbs") converted = String(Math.round(v / 2.20462 * 10) / 10);
    }
    setDraft((d) => ({ ...d, weightUnit: newUnit, weightValue: converted }));
  }

  function changeHeightUnit(newUnit) {
    if (!draft || newUnit === draft.heightUnit) return;
    const ft  = Number(draft.heightFt)  || 0;
    const inc = Number(draft.heightIn)  || 0;
    const m   = Number(draft.heightM)   || 0;
    const cm  = Number(draft.heightCm)  || 0;

    let newFt = "", newIn = "", newM = "", newCm = "";
    if (newUnit === "m" && draft.heightUnit === "ft") {
      const totalCm = ft * 30.48 + inc * 2.54;
      newM  = String(Math.floor(totalCm / 100));
      newCm = String(Math.round(totalCm % 100));
      newFt = draft.heightFt; newIn = draft.heightIn;
    } else if (newUnit === "ft" && draft.heightUnit === "m") {
      const totalInches = (m * 100 + cm) / 2.54;
      newFt = String(Math.floor(totalInches / 12));
      newIn = String(Math.round(totalInches % 12));
      newM = draft.heightM; newCm = draft.heightCm;
    }
    setDraft((d) => ({ ...d, heightUnit: newUnit, heightFt: newFt, heightIn: newIn, heightM: newM, heightCm: newCm }));
  }

  const view = useMemo(() => {
    const p = profile || {};
    const st = streak || {};
    const wVal = latestWeight?.weightValue ?? p.weightValue ?? null;
    const wUnit = latestWeight?.weightUnit ?? p.weightUnit ?? "";
    return {
      displayName: p.displayName ?? auth?.displayName ?? "—",
      age: String(p.age ?? "—"),
      gender: p.gender ?? "—",
      activityLevel: p.activityLevel ?? "—",
      experienceLevel: p.experienceLevel ?? "—",
      bodyType: p.bodyType ?? "—",
      weightPretty: wVal == null ? "—" : `${wVal}${wUnit ? ` ${unitLabel(wUnit)}` : ""}`,
      heightPretty: formatHeight(p.heightValue, p.heightUnit),
      currentStreakDays: String(st.currentStreakDays ?? "—"),
      totalWorkouts: String(st.totalWorkouts ?? "—"),
    };
  }, [profile, streak, latestWeight, auth]);

  const activeBg = BACKGROUNDS.find((b) => b.key === bgKey) ?? BACKGROUNDS[0];
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const activeCat = AIM_CATEGORIES.find((c) => c.key === aimCategory);

  // Info fields config
  const viewFields = [
    { label: "Age",            value: view.age },
    { label: "Gender",         value: view.gender },
    { label: "Height",         value: view.heightPretty },
    { label: "Weight",         value: view.weightPretty },
    { label: "Activity Level", value: view.activityLevel },
    { label: "Experience",     value: view.experienceLevel },
    { label: "Body Type",      value: view.bodyType },
  ];

  return (
    <SafeAreaView style={s.screen}>
      {/* Header bar */}
      <View style={[s.headerBar, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile</Text>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerIconBtn} onPress={() => navigation.navigate("Settings")}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerIconBtn} onPress={() => setBgModalOpen(true)}>
            <Ionicons name="color-palette-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          {!isEditing ? (
            <TouchableOpacity style={s.editBtn} onPress={startEdit} disabled={loading || !profile}>
              <Text style={[s.editBtnText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.editBtn} onPress={saveEdit} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[s.editBtnText, { color: colors.primary }]}>Save</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <TourTarget tourKey="profile_home" style={{ flex: 1 }}>
      <Animated.ScrollView contentContainerStyle={s.body} style={{ flex: 1, opacity: fadeAnim }}>

        {/* Hero banner */}
        <View style={[s.heroBanner, { backgroundColor: activeBg.color }]}>
          <TouchableOpacity style={s.avatarTouchable} onPress={pickAvatar} activeOpacity={0.85}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatar} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Ionicons name="person" size={44} color="rgba(255,255,255,0.9)" />
              </View>
            )}
            <View style={s.avatarEditBadge}>
              <Ionicons name="camera" size={13} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={s.heroName}>{view.displayName}</Text>
          <View style={s.heroBadges}>
            {view.experienceLevel !== "—" && (
              <View style={s.heroBadge}>
                <Text style={s.heroBadgeText}>{view.experienceLevel}</Text>
              </View>
            )}
            {view.activityLevel !== "—" && (
              <View style={s.heroBadge}>
                <Text style={s.heroBadgeText}>{view.activityLevel} activity</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[s.statNum, { color: activeBg.color }]}>{view.currentStreakDays}</Text>
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>Day Streak</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[s.statNum, { color: activeBg.color }]}>{view.totalWorkouts}</Text>
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>Workouts</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[s.statNum, { color: activeBg.color }]}>{view.weightPretty}</Text>
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>Weight</Text>
          </View>
        </View>

        {errorMsg ? <View style={s.errBox}><Text style={s.errText}>{errorMsg}</Text></View> : null}
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} /> : null}

        {!loading && (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <View style={s.cardTitleRow}>
              <Text style={s.cardTitle}>Personal Info</Text>
              {isEditing && (
                <TouchableOpacity onPress={cancelEdit}>
                  <Text style={[s.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* View mode: compact rows */}
            {!isEditing && (
              <View style={s.infoGrid}>
                {viewFields.map((item) => (
                  <View key={item.label} style={[s.infoRow, { borderBottomColor: colors.border }]}>
                    <Text style={[s.infoLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                    <Text style={[s.infoValue, { color: colors.text }]}>{item.value}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Edit mode: full-width stacked fields, no scroll-wheel pickers */}
            {isEditing && draft && (
              <View style={s.editSection}>

                <View style={s.editField}>
                  <Text style={[s.editLabel, { color: colors.textSecondary }]}>Display Name</Text>
                  <TextInput
                    style={[s.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={draft.displayName}
                    onChangeText={(v) => setDraft((d) => ({ ...d, displayName: v }))}
                    placeholder="Your name"
                    placeholderTextColor={colors.textLight}
                  />
                </View>

                <View style={s.editField}>
                  <Text style={[s.editLabel, { color: colors.textSecondary }]}>Age</Text>
                  <TextInput
                    style={[s.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={draft.age}
                    onChangeText={(v) => setDraft((d) => ({ ...d, age: v }))}
                    keyboardType="numeric"
                    placeholder="e.g. 25"
                    placeholderTextColor={colors.textLight}
                  />
                </View>

                <View style={s.editField}>
                  <Text style={[s.editLabel, { color: colors.textSecondary }]}>Gender</Text>
                  <SegmentedPicker
                    colors={colors}
                    value={draft.gender}
                    onChange={(v) => setDraft((d) => ({ ...d, gender: v }))}
                    options={[{ label: "Male", value: "male" }, { label: "Female", value: "female" }]}
                  />
                </View>

                <View style={s.editField}>
                  <Text style={[s.editLabel, { color: colors.textSecondary }]}>Height</Text>
                  <SegmentedPicker
                    colors={colors}
                    value={draft.heightUnit}
                    onChange={changeHeightUnit}
                    options={[{ label: "Feet & Inches", value: "ft" }, { label: "Metres & Cm", value: "m" }]}
                  />
                  {draft.heightUnit === "ft" ? (
                    <View style={s.editInputRow}>
                      <View style={s.editInputFlex}>
                        <Text style={[s.editSubLabel, { color: colors.textSecondary }]}>Feet</Text>
                        <TextInput
                          style={[s.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                          value={draft.heightFt}
                          onChangeText={(v) => setDraft((d) => ({ ...d, heightFt: v }))}
                          keyboardType="number-pad"
                          placeholder="5"
                          placeholderTextColor={colors.textLight}
                        />
                      </View>
                      <View style={s.editInputFlex}>
                        <Text style={[s.editSubLabel, { color: colors.textSecondary }]}>Inches</Text>
                        <TextInput
                          style={[s.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                          value={draft.heightIn}
                          onChangeText={(v) => setDraft((d) => ({ ...d, heightIn: v }))}
                          keyboardType="number-pad"
                          placeholder="10"
                          placeholderTextColor={colors.textLight}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={s.editInputRow}>
                      <View style={s.editInputFlex}>
                        <Text style={[s.editSubLabel, { color: colors.textSecondary }]}>Metres</Text>
                        <TextInput
                          style={[s.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                          value={draft.heightM}
                          onChangeText={(v) => setDraft((d) => ({ ...d, heightM: v }))}
                          keyboardType="number-pad"
                          placeholder="1"
                          placeholderTextColor={colors.textLight}
                        />
                      </View>
                      <View style={s.editInputFlex}>
                        <Text style={[s.editSubLabel, { color: colors.textSecondary }]}>Centimetres</Text>
                        <TextInput
                          style={[s.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                          value={draft.heightCm}
                          onChangeText={(v) => setDraft((d) => ({ ...d, heightCm: v }))}
                          keyboardType="number-pad"
                          placeholder="78"
                          placeholderTextColor={colors.textLight}
                        />
                      </View>
                    </View>
                  )}
                </View>

                <View style={s.editField}>
                  <Text style={[s.editLabel, { color: colors.textSecondary }]}>Weight</Text>
                  <SegmentedPicker
                    colors={colors}
                    value={draft.weightUnit}
                    onChange={changeWeightUnit}
                    options={[{ label: "Kilograms (Kg)", value: "kg" }, { label: "Pounds (Lbs)", value: "lbs" }]}
                  />
                  <TextInput
                    style={[s.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={draft.weightValue}
                    onChangeText={(v) => setDraft((d) => ({ ...d, weightValue: v }))}
                    keyboardType="decimal-pad"
                    placeholder={draft.weightUnit === "lbs" ? "e.g. 172" : "e.g. 78"}
                    placeholderTextColor={colors.textLight}
                  />
                </View>

                <View style={s.editField}>
                  <Text style={[s.editLabel, { color: colors.textSecondary }]}>Activity Level</Text>
                  <SegmentedPicker
                    colors={colors}
                    value={draft.activityLevel}
                    onChange={(v) => setDraft((d) => ({ ...d, activityLevel: v }))}
                    options={[{ label: "Low", value: "low" }, { label: "Moderate", value: "moderate" }, { label: "High", value: "high" }]}
                  />
                </View>

                <View style={s.editField}>
                  <Text style={[s.editLabel, { color: colors.textSecondary }]}>Experience Level</Text>
                  <SegmentedPicker
                    colors={colors}
                    value={draft.experienceLevel}
                    onChange={(v) => setDraft((d) => ({ ...d, experienceLevel: v }))}
                    options={[{ label: "Beginner", value: "beginner" }, { label: "Intermediate", value: "intermediate" }, { label: "Advanced", value: "advanced" }]}
                  />
                </View>

                <TouchableOpacity
                  style={[s.saveBtn, { backgroundColor: colors.primary }]}
                  onPress={saveEdit}
                  disabled={saving}
                  activeOpacity={0.82}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Changes</Text>}
                </TouchableOpacity>

              </View>
            )}
          </View>
        )}

        {/* Aims card */}
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <TouchableOpacity style={s.aimsTitleRow} onPress={() => setAimsOpen((v) => !v)} activeOpacity={0.7}>
            <View>
              <Text style={s.cardTitle}>Aims</Text>
              <Text style={[s.cardSub, { color: colors.textSecondary }]}>{aims.length}/{MAX_AIMS} selected</Text>
            </View>
            <Ionicons name={aimsOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {aims.length > 0 && (
            <View style={s.chips}>
              {aims.map((label) => {
                const color = getAimColor(label);
                return (
                  <View key={label} style={[s.chip, { backgroundColor: color }]}>
                    <Text style={s.chipTextActive}>{label}</Text>
                  </View>
                );
              })}
            </View>
          )}
          {aims.length === 0 && !aimsOpen && (
            <Text style={{ color: colors.textSecondary, fontSize: font.sm }}>Tap to add your aims</Text>
          )}

          {aimsOpen && (
            <View style={s.aimsPicker}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll} contentContainerStyle={s.catRow}>
                {AIM_CATEGORIES.map((cat) => {
                  const active = aimCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => setAimCategory(cat.key)}
                      style={[s.catTab, { borderColor: cat.color, backgroundColor: active ? cat.color : cat.color + "18" }]}
                    >
                      <Text style={[s.catTabText, { color: active ? "#fff" : cat.color }]}>{cat.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={s.chips}>
                {activeCat?.aims.map((a) => {
                  const selected = aims.includes(a.label);
                  const catColor = activeCat.color;
                  const disabled = !selected && aims.length >= MAX_AIMS;
                  return (
                    <TouchableOpacity
                      key={a.key}
                      onPress={() => toggleAim(a.label)}
                      disabled={disabled}
                      style={[s.chip, {
                        backgroundColor: selected ? catColor : catColor + "22",
                        borderWidth: selected ? 0 : 1.5,
                        borderColor: catColor,
                        opacity: disabled ? 0.4 : 1,
                      }]}
                    >
                      <Text style={[s.chipText, { color: selected ? "#fff" : catColor }]}>{a.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

      </Animated.ScrollView>
      </TourTarget>

      {/* Background chooser modal */}
      <Modal visible={bgModalOpen} transparent animationType="slide" onRequestClose={() => setBgModalOpen(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setBgModalOpen(false)} />
        <View style={[s.modalSheet, { backgroundColor: colors.surface }]}>
          <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[s.modalTitle, { color: colors.text }]}>Profile Background</Text>
          <View style={s.bgGrid}>
            {BACKGROUNDS.map((bg) => (
              <BgSwatch key={bg.key} bg={bg} selected={bgKey === bg.key} onPress={() => { selectBg(bg.key); setBgModalOpen(false); }} />
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    headerBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerBtn: { width: 80, alignItems: "flex-start" },
    headerTitle: { flex: 1, textAlign: "center", fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    headerRight: { width: 80, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
    headerIconBtn: { padding: 4 },
    editBtn: { paddingHorizontal: 4 },
    editBtnText: { fontSize: font.base, fontWeight: font.semiBold },
    body: { gap: spacing.md, paddingBottom: spacing.xxl },

    heroBanner: {
      alignItems: "center", paddingTop: spacing.xxl, paddingBottom: 56,
      paddingHorizontal: spacing.lg, gap: spacing.sm,
    },
    avatarTouchable: { position: "relative" },
    avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: "rgba(255,255,255,0.85)" },
    avatarPlaceholder: {
      width: 96, height: 96, borderRadius: 48,
      alignItems: "center", justifyContent: "center",
      borderWidth: 3, borderColor: "rgba(255,255,255,0.4)",
      backgroundColor: "rgba(255,255,255,0.15)",
    },
    avatarEditBadge: {
      position: "absolute", bottom: 2, right: 2,
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderColor: "#fff",
    },
    heroName: { fontSize: font.xxl, fontWeight: font.bold, color: "#fff", marginTop: spacing.sm, textShadowColor: "rgba(0,0,0,0.2)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
    heroBadges: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
    heroBadge: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4, backgroundColor: "rgba(255,255,255,0.22)" },
    heroBadgeText: { fontSize: font.sm, fontWeight: font.semiBold, color: "#fff" },

    statsRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: -36 },
    statCard: {
      flex: 1, alignItems: "center", borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: 4, gap: 2,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
    },
    statNum: { fontSize: font.lg, fontWeight: font.bold },
    statLabel: { fontSize: 10, fontWeight: "600" },

    errBox: { marginHorizontal: spacing.lg, backgroundColor: "#fee2e2", borderRadius: radius.sm, padding: spacing.md },
    errText: { color: "#b91c1c", fontSize: font.sm },

    card: {
      marginHorizontal: spacing.lg, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    cardSub: { fontSize: font.sm, marginTop: 2 },
    cancelText: { fontSize: font.sm, fontWeight: font.semiBold },

    // View mode info rows
    infoGrid: { gap: 0 },
    infoRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
    },
    infoLabel: { fontSize: font.sm, fontWeight: "600" },
    infoValue: { fontSize: font.base, fontWeight: font.semiBold, textAlign: "right" },

    // Edit mode fields
    editSection: { gap: spacing.md },
    editField: { gap: 8 },
    editLabel: { fontSize: font.sm, fontWeight: "600" },
    editSubLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
    editInput: {
      borderWidth: 1, borderRadius: 10,
      paddingHorizontal: spacing.md, paddingVertical: 13,
      fontSize: font.base,
    },
    editInputFlex: { flex: 1, gap: 0 },
    editInputRow: { flexDirection: "row", gap: 10 },
    saveBtn: {
      borderRadius: radius.lg, paddingVertical: 14, alignItems: "center", marginTop: spacing.sm,
    },
    saveBtnText: { color: "#fff", fontSize: font.base, fontWeight: font.bold, letterSpacing: 0.3 },

    aimsTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    aimsPicker: { gap: spacing.md },
    catScroll: { marginHorizontal: -4 },
    catRow: { flexDirection: "row", gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
    catTab: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 7, borderWidth: 1.5 },
    catTabText: { fontSize: font.sm, fontWeight: font.semiBold },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5 },
    chipText: { fontSize: font.sm, fontWeight: font.semiBold },
    chipTextActive: { fontSize: font.sm, color: "#fff", fontWeight: font.semiBold },

    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    modalSheet: {
      borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: 48, gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
    },
    modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: spacing.sm },
    modalTitle: { fontSize: font.lg, fontWeight: font.bold, textAlign: "center" },
    bgGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-evenly", gap: 4, backgroundColor: "#1c1c2e", borderRadius: 16, padding: spacing.md },
  });
}
