import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import apiClient from "../../api/apiClient";
import { SCAN_API_URL } from "../../config";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

const SCAN_METRICS = [
  { key: "waistCm",  label: "Waist",  unit: "cm", color: "#8b5cf6" },
  { key: "hipCm",    label: "Hips",   unit: "cm", color: "#ec4899" },
  { key: "chestCm",  label: "Chest",  unit: "cm", color: "#14b8a6" },
  { key: "bmi",      label: "BMI",    unit: "",   color: "#22c55e" },
];

const TIMER_OPTIONS = [3, 5, 10];

export default function BodyScanScreen({ navigation }) {
  const { colors } = useTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const userId = auth?.userId;
  const s = makeStyles(colors);

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  // Screen state
  const [step, setStep] = useState("guide"); // guide | camera | analyzing | result
  const [timerSecs, setTimerSecs] = useState(5);
  const [countdown, setCountdown] = useState(null); // null = idle, N = counting down
  const countdownRef = useRef(null);

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState({ waistCm: true, hipCm: true, chestCm: true, bmi: false });
  const [saving, setSaving] = useState(false);

  // Clean up interval on unmount
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  // ── Timer + capture ────────────────────────────────────────────────────────
  function startCountdown() {
    setCountdown(timerSecs);
    let remaining = timerSecs;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
        takePhoto();
      }
    }, 1000);
  }

  function cancelCountdown() {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setCountdown(null);
  }

  async function takePhoto() {
    if (!cameraRef.current) return;
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      setCountdown(null);
      setStep("analyzing");
      analyzeImage(pic.uri);
    } catch {
      setCountdown(null);
      setError("Could not take photo. Try again.");
      setStep("guide");
    }
  }

  // ── Gallery fallback ───────────────────────────────────────────────────────
  async function pickFromGallery() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setStep("analyzing");
      analyzeImage(res.assets[0].uri);
    }
  }

  // ── Open camera step ───────────────────────────────────────────────────────
  async function openCamera() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Camera Permission", "Camera access is required to take a body scan photo.");
        return;
      }
    }
    setError("");
    setCountdown(null);
    setStep("camera");
  }

  // ── Analyze image ──────────────────────────────────────────────────────────
  async function analyzeImage(uri) {
    setError("");
    try {
      const profileRes = await apiClient.get(`/api/user-profile/${userId}`).catch(() => ({ data: null }));
      const profile = profileRes.data;

      let heightCm = null;
      if (profile?.heightValue) {
        const h = Number(profile.heightValue);
        const u = (profile.heightUnit || "cm").toLowerCase();
        if (u === "ft") heightCm = h * 30.48;
        else if (u === "m") heightCm = h * 100;
        else heightCm = h;
      }

      if (!heightCm || heightCm < 100 || heightCm > 250) {
        setError("Please set your height in your profile before scanning.");
        setStep("guide");
        return;
      }

      const weightKg = profile?.weightValue
        ? (profile.weightUnit === "lbs" ? Number(profile.weightValue) * 0.453592 : Number(profile.weightValue))
        : null;

      const formData = new FormData();
      formData.append("image", { uri, name: "scan.jpg", type: "image/jpeg" });
      formData.append("height_cm", String(Math.round(heightCm)));
      if (weightKg) formData.append("weight_kg", String(Math.round(weightKg * 10) / 10));
      if (profile?.gender) formData.append("gender", profile.gender.toLowerCase());

      const response = await fetch(`${SCAN_API_URL}/analyze`, {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
      setStep("result");
    } catch (e) {
      setError(e.message || "Could not analyse image. Please try again.");
      setStep("guide");
    }
  }

  // ── Save results ───────────────────────────────────────────────────────────
  async function saveResults() {
    if (!result) return;
    setSaving(true);
    try {
      const body = {
        userId,
        weightValue: 0,
        weightUnit: "kg",
        source: "scan",
        recordedAt: new Date().toISOString(),
      };
      if (selected.waistCm && result.waistCm) body.waistCm = result.waistCm;
      if (selected.hipCm   && result.hipCm)   body.hipCm   = result.hipCm;
      if (selected.chestCm && result.chestCm) body.chestCm = result.chestCm;
      if (selected.bmi     && result.bmi)     body.bmi     = result.bmi;
      await apiClient.post("/api/weight-entries", body);
      if (result.bodyType) {
        await apiClient.put(`/api/user-profile/${userId}`, { bodyType: result.bodyType }).catch(() => {});
      }
      Alert.alert("Saved!", "Your body measurements have been saved.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert("Error", "Could not save measurements. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CAMERA STEP
  // ══════════════════════════════════════════════════════════════════════════
  if (step === "camera") {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">

          {/* Silhouette guide overlay */}
          <View style={s.camOverlay} pointerEvents="none">
            {/* dim sides */}
            <View style={s.camDimLeft} />
            <View style={s.camDimRight} />
            {/* guide outline */}
            <View style={s.silhouetteBox}>
              <View style={[s.silhouetteCorner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
              <View style={[s.silhouetteCorner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
              <View style={[s.silhouetteCorner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
              <View style={[s.silhouetteCorner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
            </View>
            {/* label */}
            <View style={s.camLabelBox}>
              <Text style={s.camLabel}>Fit your full body inside the frame</Text>
            </View>
          </View>

          {/* Countdown overlay */}
          {countdown !== null && (
            <View style={s.countdownOverlay} pointerEvents="none">
              <Text style={s.countdownNumber}>{countdown}</Text>
              <Text style={s.countdownLabel}>Stand still…</Text>
            </View>
          )}

          {/* Top bar */}
          <SafeAreaView edges={["top"]} style={s.camTopBar}>
            <TouchableOpacity onPress={() => { cancelCountdown(); setStep("guide"); }} style={s.camBackBtn}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {/* Timer selection */}
            <View style={s.camTimerRow}>
              {TIMER_OPTIONS.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.camTimerChip, timerSecs === t && s.camTimerChipActive]}
                  onPress={() => setTimerSecs(t)}
                  disabled={countdown !== null}
                >
                  <Ionicons name="timer-outline" size={12} color={timerSecs === t ? "#fff" : "rgba(255,255,255,0.7)"} />
                  <Text style={[s.camTimerText, timerSecs === t && { color: "#fff" }]}>{t}s</Text>
                </TouchableOpacity>
              ))}
            </View>
          </SafeAreaView>

          {/* Bottom controls */}
          <View style={[s.camBottomBar, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity onPress={pickFromGallery} style={s.camGalleryBtn} disabled={countdown !== null}>
              <Ionicons name="images-outline" size={26} color={countdown !== null ? "rgba(255,255,255,0.3)" : "#fff"} />
              <Text style={[s.camGalleryText, countdown !== null && { opacity: 0.3 }]}>Gallery</Text>
            </TouchableOpacity>

            {countdown === null ? (
              <TouchableOpacity style={s.camShutterBtn} onPress={startCountdown}>
                <View style={s.camShutterInner} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[s.camShutterBtn, { borderColor: "#ef4444" }]} onPress={cancelCountdown}>
                <View style={[s.camShutterInner, { backgroundColor: "#ef4444" }]} />
              </TouchableOpacity>
            )}

            {/* Spacer to balance gallery button */}
            <View style={{ width: 60 }} />
          </View>
        </CameraView>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ANALYZING STEP
  // ══════════════════════════════════════════════════════════════════════════
  if (step === "analyzing") {
    return (
      <SafeAreaView style={s.screen} edges={["top"]}>
        <View style={s.header}>
          <View style={s.headerBtn} />
          <Text style={s.headerTitle}>Body Scan</Text>
          <View style={s.headerBtn} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[s.heroTitle, { fontSize: font.lg }]}>Analysing your photo…</Text>
          <Text style={{ fontSize: font.sm, color: colors.textSecondary }}>This may take a few seconds</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESULT STEP
  // ══════════════════════════════════════════════════════════════════════════
  if (step === "result") {
    return (
      <SafeAreaView style={s.screen} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { setStep("guide"); setResult(null); setError(""); }} style={s.headerBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Scan Results</Text>
          <View style={s.headerBtn} />
        </View>
        <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + spacing.xl * 2 }]}>
          {/* Body type banner */}
          {result?.bodyType && (
            <View style={[s.bodyTypeBanner, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}>
              <Ionicons name="body-outline" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[s.bodyTypeLabel, { color: colors.textSecondary }]}>Detected Body Type</Text>
                <Text style={[s.bodyTypeValue, { color: colors.primary }]}>{result.bodyType}</Text>
              </View>
              <View style={[s.bodyTypeBadge, { backgroundColor: colors.primary }]}>
                <Text style={s.bodyTypeBadgeText}>
                  {result.bodyType === "Mesomorph" ? "Athletic" : result.bodyType === "Ectomorph" ? "Lean" : "Rounded"}
                </Text>
              </View>
            </View>
          )}

          {/* Metric results */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Estimated Measurements</Text>
            <Text style={[s.cardSub, { color: colors.textSecondary }]}>Select which to save to your tracking history</Text>
            {SCAN_METRICS.map(m => {
              const val = result?.[m.key];
              if (val == null) return null;
              const isOn = selected[m.key] ?? false;
              return (
                <TouchableOpacity key={m.key} style={s.metricRow} onPress={() => setSelected(p => ({ ...p, [m.key]: !p[m.key] }))}>
                  <View style={[s.checkbox, isOn && { backgroundColor: m.color, borderColor: m.color }]}>
                    {isOn && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.metricLabel}>{m.label}</Text>
                    <Text style={[s.metricVal, { color: m.color }]}>{val}{m.unit}</Text>
                  </View>
                  <View style={[s.accuracyBadge, { backgroundColor: m.color + "22" }]}>
                    <Text style={[s.accuracyText, { color: m.color }]}>±2–4{m.unit || " pt"}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={s.secondaryBtn} onPress={() => { setStep("guide"); setResult(null); setError(""); }}>
            <Ionicons name="camera-outline" size={16} color={colors.primary} />
            <Text style={[s.secondaryBtnText, { color: colors.primary }]}>Retake Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={saveResults}
            disabled={saving || !Object.values(selected).some(Boolean)}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Ionicons name="save-outline" size={18} color="#fff" /><Text style={s.primaryBtnText}>Save Selected</Text></>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GUIDE STEP (default)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Body Scan</Text>
        <View style={s.headerBtn} />
      </View>
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + spacing.xl }]}>

        {/* Hero */}
        <View style={s.heroCard}>
          <View style={[s.heroIcon, { backgroundColor: colors.primary + "22" }]}>
            <Ionicons name="camera-outline" size={36} color={colors.primary} />
          </View>
          <Text style={s.heroTitle}>AI Body Measurements</Text>
          <Text style={s.heroSub}>
            Take a full-body photo and our model will estimate your waist, hip, and chest measurements.
          </Text>
        </View>

        {/* Timer selector */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Countdown Timer</Text>
          <Text style={[s.tipText, { color: colors.textSecondary, marginBottom: 4 }]}>
            Set your phone down, press the button, then get into position before the photo is taken.
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: 4 }}>
            {TIMER_OPTIONS.map(t => (
              <TouchableOpacity
                key={t}
                style={[s.timerChip, timerSecs === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setTimerSecs(t)}
              >
                <Ionicons name="timer-outline" size={14} color={timerSecs === t ? "#fff" : colors.textSecondary} />
                <Text style={[s.timerChipText, timerSecs === t && { color: "#fff" }]}>{t} sec</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tips */}
        <View style={s.card}>
          <Text style={s.cardTitle}>For best results</Text>
          {[
            ["person-outline",    "Stand 2–3 metres from the camera"],
            ["body-outline",      "Wear fitted clothing (no baggy layers)"],
            ["sunny-outline",     "Stand in good, even lighting"],
            ["hand-left-outline", "Arms slightly away from your body"],
            ["scan-outline",      "Full body visible — head to feet"],
          ].map(([icon, tip]) => (
            <View key={tip} style={s.tipRow}>
              <Ionicons name={icon} size={18} color={colors.primary} />
              <Text style={s.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Accuracy note */}
        <View style={[s.card, { backgroundColor: colors.primary + "11", borderColor: colors.primary + "33", borderWidth: 1 }]}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
            <Text style={[s.tipText, { flex: 1, color: colors.primary }]}>
              Estimates are typically within 2–4 cm. For maximum accuracy, use a tape measure and log values manually.
            </Text>
          </View>
        </View>

        {error ? (
          <View style={s.errorCard}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={openCamera}>
          <Ionicons name="camera" size={20} color="#fff" />
          <Text style={s.primaryBtnText}>Open Camera ({timerSecs}s timer)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.secondaryBtn} onPress={pickFromGallery}>
          <Ionicons name="images-outline" size={18} color={colors.primary} />
          <Text style={[s.secondaryBtnText, { color: colors.primary }]}>Choose from Gallery</Text>
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
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerBtn: { width: 40 },
    headerTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    body: { padding: spacing.lg, gap: spacing.md },

    heroCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl,
      alignItems: "center", gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    heroIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
    heroTitle: { fontSize: font.xl, fontWeight: "800", color: colors.text, textAlign: "center" },
    heroSub: { fontSize: font.sm, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },

    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    cardTitle: { fontSize: font.base, fontWeight: "700", color: colors.text, marginBottom: 2 },
    cardSub: { fontSize: font.sm, marginBottom: spacing.sm },
    tipRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
    tipText: { fontSize: font.sm, color: colors.textSecondary, flex: 1, lineHeight: 18 },

    // Timer chips (guide screen)
    timerChip: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
      paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    },
    timerChipText: { fontSize: font.sm, fontWeight: "700", color: colors.textSecondary },

    errorCard: {
      flexDirection: "row", alignItems: "flex-start", gap: 8,
      backgroundColor: colors.error + "18", borderRadius: radius.md, padding: spacing.md,
    },
    errorText: { flex: 1, fontSize: font.sm, color: colors.error, lineHeight: 18 },

    primaryBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, paddingVertical: 15, borderRadius: radius.lg,
    },
    primaryBtnText: { color: "#fff", fontSize: font.base, fontWeight: "700" },
    secondaryBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, paddingVertical: 13, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.primary,
    },
    secondaryBtnText: { fontSize: font.base, fontWeight: "700" },

    // ── Camera view ───────────────────────────────────────────────────────────
    camOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
    camDimLeft:  { width: "10%", height: "100%", backgroundColor: "rgba(0,0,0,0.45)" },
    camDimRight: { width: "10%", height: "100%", backgroundColor: "rgba(0,0,0,0.45)", marginLeft: "auto" },
    silhouetteBox: {
      position: "absolute", left: "10%", right: "10%", top: "4%", bottom: "4%",
    },
    silhouetteCorner: {
      position: "absolute", width: 24, height: 24, borderColor: "rgba(255,255,255,0.9)",
    },
    camLabelBox: {
      position: "absolute", bottom: "6%", left: "10%", right: "10%",
      alignItems: "center",
    },
    camLabel: {
      color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600",
      backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    },

    // Countdown
    countdownOverlay: {
      ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    countdownNumber: { fontSize: 120, fontWeight: "900", color: "#fff", lineHeight: 130 },
    countdownLabel: { fontSize: 18, fontWeight: "700", color: "rgba(255,255,255,0.85)", marginTop: -8 },

    // Camera top bar
    camTopBar: {
      position: "absolute", top: 0, left: 0, right: 0,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    },
    camBackBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center",
    },
    camTimerRow: { flexDirection: "row", gap: 8 },
    camTimerChip: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.4)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)",
    },
    camTimerChipActive: { backgroundColor: "rgba(11,132,255,0.75)", borderColor: "#0b84ff" },
    camTimerText: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.7)" },

    // Camera bottom bar
    camBottomBar: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 32, paddingTop: 16,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    camGalleryBtn: { width: 60, alignItems: "center", gap: 4 },
    camGalleryText: { color: "#fff", fontSize: 11, fontWeight: "600" },
    camShutterBtn: {
      width: 72, height: 72, borderRadius: 36,
      borderWidth: 4, borderColor: "#fff",
      alignItems: "center", justifyContent: "center",
    },
    camShutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },

    // Results
    bodyTypeBanner: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1,
    },
    bodyTypeLabel: { fontSize: 11, fontWeight: "600" },
    bodyTypeValue: { fontSize: font.xl, fontWeight: "800" },
    bodyTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
    bodyTypeBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    metricRow: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
    },
    checkbox: {
      width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
      alignItems: "center", justifyContent: "center",
    },
    metricLabel: { fontSize: font.sm, color: colors.textSecondary, fontWeight: "600" },
    metricVal: { fontSize: font.xl, fontWeight: "800" },
    accuracyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
    accuracyText: { fontSize: 10, fontWeight: "700" },
  });
}
