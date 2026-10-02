import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeContext";
import { font, radius, spacing } from "../theme";
import apiClient from "../api/apiClient";

const DANGER = "#ef4444";
const CONFIRM_WORD = "DELETE";

const ERASED = [
  { icon: "person-outline",    text: "Your profile, goals and onboarding answers" },
  { icon: "restaurant-outline", text: "Every meal you have logged and your nutrition history" },
  { icon: "scale-outline",     text: "Your weight, BMI and body composition history" },
  { icon: "barbell-outline",   text: "All workouts, plans and exercise records" },
  { icon: "chatbubbles-outline", text: "Your messages and notifications" },
  { icon: "people-outline",    text: "Your friends and every friend request" },
];

function serverMessage(ex) {
  const data = ex?.response?.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  const msg = data?.message;
  if (typeof msg === "string" && msg.trim()) return msg.trim();
  return "";
}

export default function DeleteAccountModal({ visible, onClose, onDeleted }) {
  const { colors } = useTheme();

  const [step,  setStep]  = useState(1);
  const [typed, setTyped] = useState("");
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState("");

  useEffect(() => {
    if (!visible) return;
    setStep(1); setTyped(""); setBusy(false); setErr("");
  }, [visible]);

  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;

  function close() {
    if (busy) return;
    onClose();
  }

  async function onDelete() {
    if (busy) return;
    if (!confirmed) return setErr(`Type ${CONFIRM_WORD} to confirm.`);
    try {
      setBusy(true);
      setErr("");
      // Erasing every table the account touches runs as one transaction and can
      // outlast the shared 15s default. Timing out here would tell the user
      // nothing was removed while the server went on to commit the deletion.
      await apiClient.delete("/api/user-data/account", { timeout: 60000 });
    } catch (ex) {
      setErr(serverMessage(ex) || "We couldn't delete your account. Nothing has been removed — please try again.");
      setBusy(false);
      return;
    }
    // Leaves busy set: the caller signs the user out and this screen unmounts.
    onDeleted();
  }

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.sheet}>
          <ScrollView contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <View style={s.iconBadge}>
              <Ionicons name="warning-outline" size={26} color={DANGER} />
            </View>
            <Text style={s.title}>Delete Account</Text>

            {err ? (
              <View style={s.errBox}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
                <Text style={s.errText}>{err}</Text>
              </View>
            ) : null}

            {step === 1 ? (
              <>
                <Text style={s.sub}>
                  This permanently erases your account and every piece of health data in it:
                </Text>
                <View style={s.list}>
                  {ERASED.map(item => (
                    <View key={item.icon} style={s.listRow}>
                      <Ionicons name={item.icon} size={16} color={DANGER} />
                      <Text style={s.listText}>{item.text}</Text>
                    </View>
                  ))}
                </View>
                <Text style={s.warnText}>
                  Deletion is immediate and permanent. It cannot be undone, and we cannot recover any
                  of it for you afterwards. If you only want to stop using the app, log out instead.
                </Text>
                <TouchableOpacity style={s.dangerBtn} onPress={() => { setErr(""); setStep(2); }}>
                  <Text style={s.dangerBtnText}>Continue</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelBtn} onPress={close}>
                  <Text style={s.cancelText}>Keep my account</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.sub}>
                  Last chance. Type <Text style={s.confirmWord}>{CONFIRM_WORD}</Text> below to erase
                  your account and all of its data forever.
                </Text>
                <TextInput
                  style={[s.input, typed !== "" && !confirmed && s.inputErr]}
                  value={typed}
                  onChangeText={v => { setTyped(v); setErr(""); }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!busy}
                  placeholder={CONFIRM_WORD}
                  placeholderTextColor={colors.textLight}
                />
                <TouchableOpacity
                  style={[s.dangerBtn, (!confirmed || busy) && s.btnDisabled]}
                  onPress={onDelete}
                  disabled={busy}
                >
                  {busy
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.dangerBtnText}>Delete my account forever</Text>
                  }
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
    iconBadge: {
      width: 52, height: 52, borderRadius: radius.full, alignSelf: "center",
      alignItems: "center", justifyContent: "center", backgroundColor: DANGER + "1A",
    },
    title: { fontSize: font.xl, fontWeight: font.bold, color: colors.text, textAlign: "center" },
    sub:   { fontSize: font.sm, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
    confirmWord: { fontWeight: font.bold, color: colors.error },
    errBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.error + "1A", borderRadius: radius.md, padding: spacing.md,
    },
    errText: { color: colors.error, fontSize: font.sm, flex: 1 },
    list: {
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
      borderRadius: radius.md, padding: spacing.md, gap: 8,
    },
    listRow:  { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    listText: { fontSize: 12, color: colors.text, flex: 1, lineHeight: 17 },
    warnText: { fontSize: 12, color: colors.error, fontWeight: font.semiBold, lineHeight: 17 },
    input: {
      borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg,
      padding: spacing.md, fontSize: font.lg, fontWeight: font.bold, letterSpacing: 2,
      textAlign: "center", color: colors.text, backgroundColor: colors.background,
    },
    inputErr: { borderColor: DANGER },
    dangerBtn: {
      backgroundColor: DANGER, borderRadius: radius.lg, paddingVertical: 14,
      alignItems: "center", justifyContent: "center", marginTop: spacing.sm,
    },
    dangerBtnText: { color: "#fff", fontSize: font.base, fontWeight: font.bold },
    btnDisabled:   { opacity: 0.5 },
    cancelBtn:  { alignItems: "center", paddingVertical: 8 },
    cancelText: { fontSize: font.base, color: colors.textSecondary, fontWeight: font.semiBold },
  });
}
