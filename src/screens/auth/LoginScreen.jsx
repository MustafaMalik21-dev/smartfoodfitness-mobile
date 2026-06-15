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

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
function isValidEmail(v) { return EMAIL_RE.test(String(v || "").trim()); }

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const { login } = useAuth();
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [busy, setBusy]                 = useState(false);
  const [serverErr, setServerErr]       = useState("");

  const emailVal = email.trim();
  const emailInvalid = emailTouched && emailVal !== "" && !isValidEmail(emailVal);

  async function onSubmit() {
    if (busy) return;
    setEmailTouched(true);
    if (!emailVal)            return setServerErr("Please enter your email.");
    if (!isValidEmail(emailVal)) return setServerErr("Please enter a valid email (e.g. you@example.com).");
    if (!password)            return setServerErr("Please enter your password.");
    try {
      setBusy(true);
      setServerErr("");
      await login(emailVal, password);
    } catch (ex) {
      setServerErr(ex?.response?.data?.message || "Login failed. Check your credentials.");
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
            <Text style={s.h1}>Welcome back</Text>
            <Text style={s.sub}>Sign in to continue tracking your progress.</Text>

            {serverErr ? (
              <View style={s.errBox}>
                <Ionicons name="alert-circle-outline" size={15} color="#b91c1c" />
                <Text style={s.errText}>{serverErr}</Text>
              </View>
            ) : null}

            {/* Email */}
            <View style={s.field}>
              <Text style={s.label}>Email</Text>
              <TextInput
                style={[s.input, emailInvalid && s.inputErr]}
                value={email}
                onChangeText={v => { setEmail(v); setServerErr(""); }}
                onBlur={() => setEmailTouched(true)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@example.com"
                placeholderTextColor={colors.textLight}
              />
              {emailInvalid ? (
                <View style={s.inlineErrRow}>
                  <Ionicons name="close-circle-outline" size={13} color="#ef4444" />
                  <Text style={s.inlineErr}>Enter a valid email address.</Text>
                </View>
              ) : null}
            </View>

            {/* Password */}
            <View style={s.field}>
              <Text style={s.label}>Password</Text>
              <View style={s.pwWrap}>
                <TextInput
                  style={s.pwInput}
                  value={password}
                  onChangeText={v => { setPassword(v); setServerErr(""); }}
                  secureTextEntry={!showPassword}
                  placeholder="Enter your password"
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
            </View>

            <TouchableOpacity style={[s.btn, busy && s.btnDisabled]} onPress={onSubmit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign in</Text>}
            </TouchableOpacity>

            <View style={s.footer}>
              <Text style={s.footerText}>No account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                <Text style={s.footerLink}>Create one</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen:       { flex: 1, backgroundColor: colors.background },
    scroll:       { flexGrow: 1, padding: spacing.xxl, justifyContent: "center", gap: spacing.xl },
    brandRow:     { alignItems: "center", gap: spacing.md },
    brandIcon: {
      width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    brandIconText: { color: "#fff", fontSize: font.lg, fontWeight: font.bold },
    appTitle:     { fontSize: font.lg, fontWeight: font.bold, color: colors.primary },
    panel: {
      backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xxl, gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
    },
    h1:           { fontSize: font.xxl, fontWeight: font.bold, color: colors.text },
    sub:          { fontSize: font.md, color: colors.textSecondary, marginBottom: spacing.sm },
    errBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: "#fee2e2", borderRadius: radius.md, padding: spacing.md,
    },
    errText:      { color: "#b91c1c", fontSize: font.sm, flex: 1 },
    field:        { gap: 6 },
    label:        { fontSize: font.sm, fontWeight: font.semiBold, color: colors.textSecondary },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
      padding: spacing.md, fontSize: font.base, color: colors.text, backgroundColor: colors.background,
    },
    inputErr:     { borderColor: "#ef4444", borderWidth: 1.5 },
    inlineErrRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    inlineErr:    { fontSize: 11, color: "#ef4444", fontWeight: "600" },
    pwWrap: {
      flexDirection: "row", alignItems: "center",
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
      backgroundColor: colors.background,
    },
    pwInput: {
      flex: 1, padding: spacing.md, fontSize: font.base, color: colors.text,
    },
    eyeBtn:       { padding: spacing.md },
    btn: {
      backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 15,
      alignItems: "center", marginTop: spacing.sm,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    btnDisabled:  { opacity: 0.6 },
    btnText:      { color: "#fff", fontSize: font.lg, fontWeight: font.bold },
    footer:       { flexDirection: "row", justifyContent: "center", marginTop: spacing.sm },
    footerText:   { color: colors.textSecondary, fontSize: font.sm },
    footerLink:   { color: colors.primary, fontSize: font.sm, fontWeight: font.bold },
  });
}
