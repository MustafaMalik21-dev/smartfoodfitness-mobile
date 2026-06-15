import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../utils/notificationService";

function toDateLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return d.toLocaleDateString();
}

function normalizeType(t) {
  const raw = String(t || "").trim().toLowerCase();
  if (["food", "workout", "streak", "system", "general"].includes(raw)) return raw;
  return "general";
}

const TYPE_META = {
  food:    { icon: "nutrition-outline",    color: "#22c55e", label: "Food"    },
  workout: { icon: "barbell-outline",      color: "#0b84ff", label: "Workout" },
  streak:  { icon: "flame-outline",        color: "#f97316", label: "Streak"  },
  system:  { icon: "settings-outline",     color: "#8b5cf6", label: "System"  },
  general: { icon: "scale-outline",        color: "#06b6d4", label: "General" },
};

function getMeta(type) {
  return TYPE_META[type] || TYPE_META.general;
}

const FILTERS = ["All", "Food", "Workout", "Streak", "General", "Unread"];

export default function NotificationsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { auth } = useAuth();
  const userId = auth?.userId;
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("All");

  useFocusEffect(useCallback(() => {
    if (userId) getNotifications(userId).then(setItems);
  }, [userId]));

  async function handleMarkRead(id) {
    await markNotificationRead(userId, id);
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(userId);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  const filtered = useMemo(() => {
    const f = filter.toLowerCase();
    if (f === "all")    return items;
    if (f === "unread") return items.filter((n) => !n.isRead);
    return items.filter((n) => normalizeType(n.notificationType) === f);
  }, [items, filter]);

  const unreadCount = items.filter((n) => !n.isRead).length;

  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={s.unreadBadge}>
              <Text style={s.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={s.headerBtn}>
            <Text style={s.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.headerBtn} />
        )}
      </View>

      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[s.filterBtn, filter === f && s.filterBtnOn]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.filterText, filter === f && s.filterTextOn]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {filtered.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="notifications-off-outline" size={44} color={colors.textSecondary} />
            <Text style={s.emptyText}>No notifications yet</Text>
            <Text style={s.emptySub}>Notifications will appear here after you log workouts, food, or weight.</Text>
          </View>
        ) : (
          filtered.map((n) => {
            const t = normalizeType(n.notificationType);
            const meta = getMeta(t);
            return (
              <TouchableOpacity
                key={n.id}
                style={[s.card, !n.isRead && { borderLeftColor: meta.color, borderLeftWidth: 3 }]}
                onPress={() => { if (!n.isRead) handleMarkRead(n.id); }}
                activeOpacity={n.isRead ? 1 : 0.7}
              >
                <View style={[s.iconWrap, { backgroundColor: meta.color + (n.isRead ? "18" : "28") }]}>
                  <Ionicons name={meta.icon} size={20} color={n.isRead ? meta.color + "99" : meta.color} />
                </View>
                <View style={s.cardBody}>
                  <View style={s.cardTop}>
                    <View style={s.titleRow}>
                      {!n.isRead && <View style={[s.dot, { backgroundColor: meta.color }]} />}
                      <Text style={[s.cardTitle, n.isRead && { color: colors.textSecondary }]} numberOfLines={1}>
                        {n.title}
                      </Text>
                    </View>
                    <Text style={s.cardTime}>{toDateLabel(n.createdAt)}</Text>
                  </View>
                  <Text style={s.cardMsg} numberOfLines={2}>{n.message}</Text>
                  {!n.isRead && (
                    <Text style={[s.tapHint, { color: meta.color }]}>Tap to mark as read</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors, isDark) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerBtn: { width: 80 },
    headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    headerTitle: { fontSize: font.lg, fontWeight: font.bold, color: colors.text },
    unreadBadge: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
    unreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    markAllText: { fontSize: 12, color: colors.primary, fontWeight: "600", textAlign: "right" },
    filterBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    filterRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    filterBtn: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    filterBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontSize: font.sm, color: colors.textSecondary },
    filterTextOn: { color: "#fff", fontWeight: font.semiBold },
    body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 40 },
    emptyWrap: { alignItems: "center", gap: spacing.sm, paddingTop: 60 },
    emptyText: { fontSize: font.lg, fontWeight: font.bold, color: colors.textSecondary },
    emptySub: { fontSize: font.sm, color: colors.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: spacing.xl },
    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg,
      padding: spacing.md, flexDirection: "row", gap: spacing.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    },
    iconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    cardBody: { flex: 1, gap: 3 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1, marginRight: 8 },
    dot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
    cardTitle: { fontSize: font.base, fontWeight: font.semiBold, color: colors.text, flex: 1 },
    cardTime: { fontSize: 11, color: colors.textSecondary, flexShrink: 0 },
    cardMsg: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 18 },
    tapHint: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  });
}
