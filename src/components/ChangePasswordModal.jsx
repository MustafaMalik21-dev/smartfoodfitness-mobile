import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeContext";
import { font, radius, spacing } from "../theme";
import apiClient from "../api/apiClient";

// Mirrors the policy shown on RegisterScreen. The two lists must stay identical —
// the server rejects anything that fails the same checks.
const PW_RULES = [
  { key: "len",     label: "At least 8 characters",      test: pw => pw.length >= 8 },
  { key: "upper",   label: "Uppercase letter (A–Z)",      test: pw => /[A-Z]/.test(pw) },
  { key: "lower",   label: "Lowercase letter (a–z)",      test: pw => /[a-z]/.test(pw) },
  { key: "digit",   label: "Number (0–9)",                test: pw => /[0-9]/.test(pw) },
  { key: "special", label: "Special character (!@#$…)",   test: pw => /[^A-Za-z0-9]/.test(pw) },
];

function pwStrength(pw) {
  if (!pw) return { level: 0, label: "", color: "#e2e8f0", bars: 0 };
  const passed = PW_RULES.filter(r => r.test(pw)).length;
  if (passed <= 1) return { level: 1, label: "Weak",        color: "#ef4444", bars: 1 };
  if (passed <= 2) return { level: 2, label: "Fair",        color: "#f97316", bars: 2 };
  if (passed <= 3) return { level: 3, label: "Good",        color: "#eab308", bars: 3 };
  if (passed <= 4) return { level: 4, label: "Strong",      color: "#22c55e", bars: 4 };
  return              { level: 4, label: "Very Strong",  color: "#16a34a", bars: 4 };
}

function serverMessage(ex) {
  const data = ex?.response?.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  const msg = data?.message;
  if (typeof msg === "string" && msg.trim()) return msg.trim();
  return "";
}

export default function ChangePasswordModal({ visible, onClose }) {
  const { colors } = useTheme();

  const [current,        setCurrent]        = useState("");
  const [next,           setNext]           = useState("");
  const [confirm,        setConfirm]        = useState("");
  const [showCurrent,    setShowCurrent]    = useState(false);
  const [showNext,       setShowNext]       = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [nextTouched,    setNextTouched]    = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");
  const [done, setDone] = useState(false);

  // Never carry a typed password into the next time the sheet is opened.
  useEffect(() => {
    if (!visible) return;
    setCurrent(""); setNext(""); setConfirm("");
    setShowCurrent(false); setShowNext(false); setShowConfirm(false);
    setNextTouched(false); setConfirmTouched(false);
    setBusy(false); setErr(""); setDone(false);
  }, [visible]);

  const strength    = useMemo(() => pwStrength(next), [next]);
  const pwChecks    = PW_RULES.map(r => ({ ...r, passed: r.test(next) }));
  const allPwPassed = pwChecks.every(r => r.passed);
  const mismatch    = confirmTouched && confirm !== "" && confirm !== next;

  function close() {
    if (busy) return;
    onClose();
  }

  async function onSubmit() {
    if (busy) return;
    setNextTouched(true);
    setConfirmTouched(true);

    if (!current)         return setErr("Please enter your current password.");
    if (!next)            return setErr("Please enter a new password.");
    if (!allPwPassed)     return setErr("New password doesn't meet all the requirements below.");
    if (next === current) return setErr("Your new password must be different from your current one.");
    if (confirm !== next) return setErr("The two new passwords don't match.");

    try {
      setBusy(true);
      setErr("");
      await apiClient.post("/api/auth/change-password", { currentPassword: current, newPassword: next });
      setDone(true);
    } catch (ex) {
      const status = ex?.response?.status;
      const msg = serverMessage(ex);
      if (status === 401)      setErr(msg || "That current password is incorrect.");
      else if (status === 400) setErr(msg || "That new password was rejected. Please choose a different one.");
      else                     setErr(msg || "Couldn't change your password. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.sheet}>
          <ScrollView contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {done ? (
              <View style={s.doneWrap}>
                <Ionicons name="checkmark-circle" size={52} color="#22c55e" />
                <Text style={s.title}>Password changed</Text>
                <Text style={s.doneText}>
                  Your new password is active. For your safety every other device signed in to this
                  account has been signed out — sign in there again with the new password.
                </Text>
                <Text style={s.doneNote}>
                  If this device asks you to sign in again, use your new password.
                </Text>
                <TouchableOpacity style={[s.submitBtn, s.doneBtn]} onPress={close}>
                  <Text style={s.submitText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={s.title}>Change Password</Text>
                <Text style={s.sub}>Choose a strong password you don't use anywhere else.</Text>

                {err ? (
                  <View style={s.errBox}>
                    <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
                    <Text style={s.errText}>{err}</Text>
                  </View>
                ) : null}

                {/* Current password */}
                <View style={s.field}>
                  <Text style={s.label}>Current password</Text>
                  <View style={s.pwWrap}>
                    <TextInput
                      style={s.pwInput}
                      value={current}
                      onChangeText={v => { setCurrent(v); setErr(""); }}
                      secureTextEntry={!showCurrent}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="Your current password"
                      placeholderTextColor={colors.textLight}
                    />
                    <TouchableOpacity
                      style={s.eyeBtn}
                      onPress={() => setShowCurrent(v => !v)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={showCurrent ? "eye-off-outline" : "eye-outline"}
                        size={18}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* New password */}
                <View style={s.field}>
                  <Text style={s.label}>New password</Text>
                  <View style={[s.pwWrap, nextTouched && next && !allPwPassed && s.pwWrapErr]}>
                    <TextInput
                      style={s.pwInput}
                      value={next}
                      onChangeText={v => { setNext(v); setErr(""); }}
                      onBlur={() => setNextTouched(true)}
                      secureTextEntry={!showNext}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="Create a strong password"
                      placeholderTextColor={colors.textLight}
                    />
                    <TouchableOpacity
                      style={s.eyeBtn}
                      onPress={() => setShowNext(v => !v)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={showNext ? "eye-off-outline" : "eye-outline"}
                        size={18}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  {next.length > 0 ? (
                    <View style={s.strengthWrap}>
                      <View style={s.strengthBars}>
                        {[1, 2, 3, 4].map(i => (
                          <View
                            key={i}
                            style={[
                              s.strengthBar,
                              { backgroundColor: i <= strength.bars ? strength.color : colors.border },
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={[s.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                    </View>
                  ) : null}

                  {nextTouched ? (
                    <View style={s.rulesBox}>
                      {pwChecks.map(r => (
                        <View key={r.key} style={s.ruleRow}>
                          <Ionicons
                            name={r.passed ? "checkmark-circle" : "ellipse-outline"}
                            size={14}
                            color={r.passed ? "#22c55e" : colors.textLight}
                          />
                          <Text style={[s.ruleText, { color: r.passed ? colors.text : colors.textSecondary }]}>
                            {r.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>

                {/* Confirm new password */}
                <View style={s.field}>
                  <Text style={s.label}>Confirm new password</Text>
                  <View style={[s.pwWrap, mismatch && s.pwWrapErr]}>
                    <TextInput
                      style={s.pwInput}
                      value={confirm}
                      onChangeText={v => { setConfirm(v); setErr(""); }}
                      onBlur={() => setConfirmTouched(true)}
                      secureTextEntry={!showConfirm}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="Re-enter the new password"
                      placeholderTextColor={colors.textLight}
                    />
                    <TouchableOpacity
                      style={s.eyeBtn}
                      onPress={() => setShowConfirm(v => !v)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={showConfirm ? "eye-off-outline" : "eye-outline"}
                        size={18}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                  {mismatch ? <InlineErr msg="Both new password fields must match." /> : null}
                </View>

                <TouchableOpacity style={[s.submitBtn, busy && s.btnDisabled]} onPress={onSubmit} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Update Password</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelBtn} onPress={close} disabled={busy}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function InlineErr({ msg }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
      <Ionicons name="close-circle-outline" size={13} color="#ef4444" />
      <Text style={{ fontSize: 11, color: "#ef4444", fontWeight: "600", flex: 1 }}>{msg}</Text>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    overlay: {
      flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center", alignItems: "center",
    },
    sheet: {
      backgroundColor: colors.surface, borderRadius: radius.xl,
      width: "88%", maxHeight: "88%", paddingVertical: spacing.xl,
    },
    sheetBody: { paddingHorizontal: spacing.xl, gap: spacing.md },
    title: { fontSize: font.xl, fontWeight: font.bold, color: colors.text, textAlign: "center" },
    sub:   { fontSize: font.sm, color: colors.textSecondary, textAlign: "center" },
    errBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.error + "1A", borderRadius: radius.md, padding: spacing.md,
    },
    errText: { color: colors.error, fontSize: font.sm, flex: 1 },
    field:   { gap: 6 },
    label:   { fontSize: font.sm, fontWeight: font.semiBold, color: colors.textSecondary },
    pwWrap: {
      flexDirection: "row", alignItems: "center",
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
      backgroundColor: colors.background,
    },
    pwWrapErr: { borderColor: "#ef4444", borderWidth: 1.5 },
    pwInput:   { flex: 1, padding: spacing.md, fontSize: font.base, color: colors.text },
    eyeBtn:    { padding: spacing.md },
    strengthWrap:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    strengthBars:  { flexDirection: "row", gap: 4, flex: 1 },
    strengthBar:   { flex: 1, height: 4, borderRadius: 2 },
    strengthLabel: { fontSize: 11, fontWeight: "700", minWidth: 70, textAlign: "right" },
    rulesBox: {
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
      borderRadius: radius.md, padding: spacing.md, gap: 6, marginTop: 4,
    },
    ruleRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
    ruleText: { fontSize: 12, fontWeight: "500" },
    submitBtn: {
      backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 14,
      alignItems: "center", justifyContent: "center", marginTop: spacing.sm,
    },
    submitText:  { color: "#fff", fontSize: font.base, fontWeight: font.bold },
    btnDisabled: { opacity: 0.6 },
    cancelBtn:   { alignItems: "center", paddingVertical: 8 },
    cancelText:  { fontSize: font.base, color: colors.textSecondary },
    doneWrap:    { alignItems: "center", gap: spacing.md },
    doneBtn:     { alignSelf: "stretch" },
    doneText:    { fontSize: font.sm, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
    doneNote:    { fontSize: 11, color: colors.textLight, textAlign: "center", lineHeight: 16 },
  });
}
