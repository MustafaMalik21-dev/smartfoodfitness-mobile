import { useEffect, useState } from "react";
import { DeviceEventEmitter, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useAuth } from "../auth/useAuth";
import { useTheme } from "../ThemeContext";
import { getNotifications } from "../utils/notificationService";

export default function NotificationBell({ onPress, style }) {
  const { colors } = useTheme();
  const { auth } = useAuth();
  const userId = auth?.userId;
  const isFocused = useIsFocused();
  const [unread, setUnread] = useState(0);

  // Refresh on screen focus
  useEffect(() => {
    if (!userId || !isFocused) return;
    getNotifications(userId).then((items) => {
      setUnread(items.filter((n) => !n.isRead).length);
    });
  }, [userId, isFocused]);

  // Refresh immediately whenever a new notification is posted (from any screen)
  useEffect(() => {
    if (!userId) return;
    const sub = DeviceEventEmitter.addListener("sff_notification_new", () => {
      getNotifications(userId).then((items) => {
        setUnread(items.filter((n) => !n.isRead).length);
      });
    });
    return () => sub.remove();
  }, [userId]);

  const hasUnread = unread > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.btn, style, { backgroundColor: hasUnread ? colors.primary + "14" : colors.border + "60", borderColor: hasUnread ? colors.primary + "35" : "transparent" }]}
      activeOpacity={0.7}
    >
      <Ionicons
        name={hasUnread ? "notifications" : "notifications-outline"}
        size={17}
        color={hasUnread ? colors.primary : colors.text}
      />
      {hasUnread && (
        <View style={[s.badge, { borderColor: colors.surface }]}>
          <Text style={s.badgeText}>{unread > 9 ? "9+" : String(unread)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
  },
  badge: {
    position: "absolute", top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#ef4444",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800", lineHeight: 11 },
});
