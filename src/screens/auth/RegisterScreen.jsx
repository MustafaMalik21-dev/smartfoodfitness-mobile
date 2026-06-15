import { useMemo, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

// ─── Validation helpers ───────────────────────────────────────────────────────

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
function isValidEmail(v) { return EMAIL_RE.test(String(v || "").trim()); }

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const { register } = useAuth();

  const [displayName,      setDisplayName]      = useState("");
  const [email,            setEmail]            = useState("");
  const [password,         setPassword]         = useState("");
  const [showPassword,     setShowPassword]     = useState(false);

  const [nameTouched,      setNameTouched]      = useState(false);
  const [emailTouched,     setEmailTouched]     = useState(false);
  const [passwordTouched,  setPasswordTouched]  = useState(false);

  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState("");

  const emailVal     = email.trim();
  const emailInvalid = emailTouched && emailVal !== "" && !isValidEmail(emailVal);
  const strength     = useMemo(() => pwStrength(password), [password]);
  const pwChecks     = PW_RULES.map(r => ({ ...r, passed: r.test(password) }));
  const allPwPassed  = pwChecks.every(r => r.passed);

  async function onSubmit() {
    if (busy) return;
    setNameTouched(true);
    setEmailTouched(true);
    setPasswordTouched(true);

    const dn = displayName.trim();
    if (!dn)                    return setErr("Please enter a display name.");
    if (!emailVal)              return setErr("Please enter your email.");
    if (!isValidEmail(emailVal)) return setErr("Please enter a valid email (e.g. you@example.com).");
    if (!password)              return setErr("Please enter a password.");
    if (!allPwPassed)           return setErr("Password doesn't meet all the requirements below.");

    try {
      setBusy(true);
      setErr("");
      await register(dn, emailVal, password);
    } catch (ex) {
      const data = ex?.response?.data;
      if (data?.fieldErrors) {
        const fe = data.fieldErrors;
        const first = fe.password || fe.email || fe.displayName || Object.values(fe)[0];
        setErr(first ? String(first) : "Registration failed.");
      } else {
        setErr(data?.message ? String(data.message) : "Registration failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.brandRow}>
            <View style={s.brandIcon}><Text style={s.brandIconText}>SFF</Text></View>
            <Text style={s.appTitle}>Smart Food & Fitness</Text>
          </View>

          <View style={s.panel}>
            <Text style={s.h1}>Create account</Text>
            <Text style={s.sub}>Let's set you up. You'll do a quick onboarding next.</Text>

            {err ? (
              <View style={s.errBox}>
                <Ionicons name="alert-circle-outline" size={15} color="#b91c1c" />
                <Text style={s.errText}>{err}</Text>
              </View>
            ) : null}

            {/* Display name */}
            <View style={s.field}>
              <Text style={s.label}>Display name</Text>
              <TextInput
                style={[s.input, nameTouched && !displayName.trim() && s.inputErr]}
                value={displayName}
                onChangeText={v => { setDisplayName(v); setErr(""); }}
                onBlur={() => setNameTouched(true)}
                autoCapitalize="words"
                placeholder="e.g. Bob"
                placeholderTextColor={colors.textLight}
              />
              {nameTouched && !displayName.trim() ? (
                <InlineErr msg="Please enter a display name." />
              ) : null}
            </View>

            {/* Email */}
            <View style={s.field}>
              <Text style={s.label}>Email</Text>
              <TextInput
                style={[s.input, emailInvalid && s.inputErr]}
                value={email}
                onChangeText={v => { setEmail(v); setErr(""); }}
                onBlur={() => setEmailTouched(true)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@example.com"
                placeholderTextColor={colors.textLight}
              />
              {emailInvalid ? (
                <InlineErr msg="Enter a valid email address (e.g. you@example.com)." />
              ) : null}
            </View>

            {/* Password */}
            <View style={s.field}>
              <Text style={s.label}>Password</Text>
              <View style={[s.pwWrap, passwordTouched && password && !allPwPassed && s.pwWrapErr]}>
                <TextInput
                  style={s.pwInput}
                  value={password}
                  onChangeText={v => { setPassword(v); setErr(""); }}
                  onBlur={() => setPasswordTouched(true)}
                  secureTextEntry={!showPassword}
                  placeholder="Create a strong password"
                  placeholderTextColor={colors.textLight}
                />
                <TouchableOpacity
                  style={s.eyeBtn}
                  onPress={() => setShowPassword(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Strength bar — shown as soon as user starts typing */}
              {password.length > 0 ? (
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

              {/* Requirements checklist — shown once user touches the field */}
              {passwordTouched ? (
                <View style={[s.rulesBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
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

            <TouchableOpacity style={[s.btn, busy && s.btnDisabled]} onPress={onSubmit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create account</Text>}
            </TouchableOpacity>

            <View style={s.footer}>
              <Text style={s.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={s.footerLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    screen:    { flex: 1, backgroundColor: colors.background },
    scroll:    { flexGrow: 1, padding: spacing.xxl, justifyContent: "center", gap: spacing.xl },
    brandRow:  { alignItems: "center", gap: spacing.md },
    brandIcon: {
      width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    brandIconText: { color: "#fff", fontSize: font.lg, fontWeight: font.bold },
    appTitle:  { fontSize: font.lg, fontWeight: font.bold, color: colors.primary },
    panel: {
      backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xxl, gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
    },
    h1:        { fontSize: font.xxl, fontWeight: font.bold, color: colors.text },
    sub:       { fontSize: font.md, color: colors.textSecondary, marginBottom: spacing.sm },
    errBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: "#fee2e2", borderRadius: radius.md, padding: spacing.md,
    },
    errText:   { color: "#b91c1c", fontSize: font.sm, flex: 1 },
    field:     { gap: 6 },
    label:     { fontSize: font.sm, fontWeight: font.semiBold, color: colors.textSecondary },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
      padding: spacing.md, fontSize: font.base, color: colors.text, backgroundColor: colors.background,
    },
    inputErr:  { borderColor: "#ef4444", borderWidth: 1.5 },
    pwWrap: {
      flexDirection: "row", alignItems: "center",
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
      backgroundColor: colors.background,
    },
    pwWrapErr: { borderColor: "#ef4444", borderWidth: 1.5 },
    pwInput:   { flex: 1, padding: spacing.md, fontSize: font.base, color: colors.text },
    eyeBtn:    { padding: spacing.md },
    // Strength
    strengthWrap:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    strengthBars:  { flexDirection: "row", gap: 4, flex: 1 },
    strengthBar:   { flex: 1, height: 4, borderRadius: 2 },
    strengthLabel: { fontSize: 11, fontWeight: "700", minWidth: 70, textAlign: "right" },
    // Rules
    rulesBox: {
      borderWidth: 1, borderRadius: radius.md, padding: spacing.md,
      gap: 6, marginTop: 4,
    },
    ruleRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
    ruleText:  { fontSize: 12, fontWeight: "500" },
    // Submit
    btn: {
      backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 15,
      alignItems: "center", marginTop: spacing.sm,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    btnDisabled: { opacity: 0.6 },
    btnText:   { color: "#fff", fontSize: font.lg, fontWeight: font.bold },
    footer:    { flexDirection: "row", justifyContent: "center", marginTop: spacing.sm },
    footerText:{ color: colors.textSecondary, fontSize: font.sm },
    footerLink:{ color: colors.primary, fontSize: font.sm, fontWeight: font.bold },
  });
}
