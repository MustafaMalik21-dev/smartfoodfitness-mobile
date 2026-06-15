import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeContext";
import { font, radius, spacing } from "../theme";

export default function StartScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.themeToggle} onPress={toggleTheme}>
          <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={s.top}>
        <View style={s.logoWrap}>
          <Text style={s.logoText}>SFF</Text>
        </View>
        <Text style={s.title}>Smart Food{"\n"}& Fitness</Text>
        <Text style={s.sub}>Track your food, workouts, and progress — all in one place.</Text>
      </View>

      <View style={s.actions}>
        <TouchableOpacity style={s.btnPrimary} onPress={() => navigation.navigate("Login")}>
          <Text style={s.btnPrimaryText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnSecondary} onPress={() => navigation.navigate("Register")}>
          <Text style={s.btnSecondaryText}>Create Account</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: {
      flex: 1, backgroundColor: colors.background, justifyContent: "space-between",
      paddingHorizontal: spacing.xxl, paddingVertical: spacing.xxxl,
    },
    top: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xl },
    logoWrap: {
      width: 88, height: 88, borderRadius: radius.xl, backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
    },
    logoText: { color: "#fff", fontSize: font.xxl, fontWeight: font.bold, letterSpacing: 1 },
    title: { fontSize: 30, fontWeight: font.bold, color: colors.text, textAlign: "center", lineHeight: 36 },
    sub: { fontSize: font.md, color: colors.textSecondary, textAlign: "center", lineHeight: 22, maxWidth: 260 },
    topBar: { alignItems: "flex-end", paddingTop: spacing.sm },
    actions: { gap: spacing.md, paddingBottom: spacing.xxl },
    btnPrimary: {
      backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 15, alignItems: "center",
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    btnPrimaryText: { color: "#fff", fontSize: font.lg, fontWeight: font.bold },
    btnSecondary: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.lg, paddingVertical: 15, alignItems: "center" },
    btnSecondaryText: { color: colors.primary, fontSize: font.lg, fontWeight: font.semiBold },
    themeToggle: { padding: 8 },
  });
}
