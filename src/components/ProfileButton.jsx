import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeContext";

export default function ProfileButton({ onPress, style }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.btn, style, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "35" }]}
      activeOpacity={0.7}
    >
      <Ionicons name="person" size={17} color={colors.primary} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
  },
});
