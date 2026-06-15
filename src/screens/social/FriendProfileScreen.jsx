import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

const AVATAR_COLORS = ["#8b5cf6","#0ea5e9","#22c55e","#f97316","#ef4444","#ec4899","#f59e0b"];
function avatarColor(id) { return AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length]; }

function Avatar({ name, size = 64, color = "#8b5cf6" }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + "22",
      alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: color + "55" }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: "700", color }}>{initials}</Text>
    </View>
  );
}

function formatSplit(split) {
  if (!split) return split;
  return split.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function FriendProfileScreen({ navigation, route }) {
  const { friend } = route.params;
  const { colors } = useTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const userId = auth?.userId;
  const col = avatarColor(friend.userId);
  const s = makeStyles(colors);

  const canSeeActivity = friend.shareActivity;
  const canSeeWeight = friend.shareWeight;
  const hasTopLifts = canSeeActivity && friend.topLifts && friend.topLifts.length > 0;
  const sharesNothing = !canSeeActivity && !canSeeWeight;

  async function handleRemove() {
    Alert.alert(
      "Remove Friend",
      `Remove ${friend.displayName} from your friends?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await apiClient.delete(`/api/friends/${friend.requestId}`, { params: { userId } });
              navigation.goBack();
            } catch {}
          },
        },
      ]
    );
  }

  function openConversation() {
    navigation.navigate("Conversation", {
      friendId: friend.userId,
      friendName: friend.displayName,
    });
  }

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Avatar name={friend.displayName} size={44} color={col} />
          <Text style={[s.headerName, { color: colors.text }]}>{friend.displayName}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={[s.actionIconBtn, { backgroundColor: col + "18" }]} onPress={openConversation}>
            <Ionicons name="chatbubble-outline" size={18} color={col} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionIconBtn, { backgroundColor: "#fee2e2" }]} onPress={handleRemove}>
            <Ionicons name="person-remove-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} showsVerticalScrollIndicator={false}>

        {/* Active Plan Card */}
        {canSeeActivity && friend.activePlanName && (
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={s.cardHeader}>
              <Ionicons name="barbell-outline" size={18} color={colors.primary} />
              <Text style={[s.cardTitle, { color: colors.text }]}>Active Plan</Text>
            </View>
            <Text style={[s.planName, { color: colors.text }]}>{friend.activePlanName}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.sm, flexWrap: "wrap" }}>
              {friend.activePlanSplit && (
                <View style={[s.badge, { backgroundColor: colors.primary + "1a" }]}>
                  <Text style={[s.badgeText, { color: colors.primary }]}>{formatSplit(friend.activePlanSplit)}</Text>
                </View>
              )}
              {friend.activePlanDaysPerWeek != null && (
                <View style={[s.badge, { backgroundColor: colors.primary + "1a" }]}>
                  <Text style={[s.badgeText, { color: colors.primary }]}>{friend.activePlanDaysPerWeek} days/week</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Activity Stats Row */}
        {canSeeActivity && (
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={s.cardHeader}>
              <Ionicons name="flame-outline" size={18} color={colors.primary} />
              <Text style={[s.cardTitle, { color: colors.text }]}>Workout Activity</Text>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={[s.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[s.statVal, { color: colors.primary }]}>{friend.workoutsThisWeek ?? 0}</Text>
                <Text style={[s.statLbl, { color: colors.textSecondary }]}>this week</Text>
              </View>
              <View style={[s.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[s.statVal, { color: colors.primary }]}>{friend.totalWorkouts ?? 0}</Text>
                <Text style={[s.statLbl, { color: colors.textSecondary }]}>total</Text>
              </View>
            </View>
          </View>
        )}

        {/* Body Stats Card */}
        {canSeeWeight && (friend.latestWeightKg != null || friend.latestBmi != null || friend.latestBodyFatPercent != null) && (
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={s.cardHeader}>
              <Ionicons name="body-outline" size={18} color={colors.primary} />
              <Text style={[s.cardTitle, { color: colors.text }]}>Body Stats</Text>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              {friend.latestWeightKg != null && (
                <View style={[s.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[s.statVal, { color: colors.primary }]}>{friend.latestWeightKg.toFixed(1)}</Text>
                  <Text style={[s.statLbl, { color: colors.textSecondary }]}>kg</Text>
                </View>
              )}
              {friend.latestBmi != null && (
                <View style={[s.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[s.statVal, { color: colors.primary }]}>{friend.latestBmi.toFixed(1)}</Text>
                  <Text style={[s.statLbl, { color: colors.textSecondary }]}>BMI</Text>
                </View>
              )}
              {friend.latestBodyFatPercent != null && (
                <View style={[s.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[s.statVal, { color: colors.primary }]}>{friend.latestBodyFatPercent.toFixed(1)}%</Text>
                  <Text style={[s.statLbl, { color: colors.textSecondary }]}>Body fat</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Top Lifts Card */}
        {hasTopLifts && (
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={s.cardHeader}>
              <Ionicons name="trophy-outline" size={18} color={colors.primary} />
              <Text style={[s.cardTitle, { color: colors.text }]}>Top Lifts</Text>
            </View>
            {friend.topLifts.map((lift, i) => (
              <View
                key={i}
                style={[s.liftRow, i < friend.topLifts.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              >
                <Text style={[s.liftName, { color: colors.text }]}>{lift.exerciseName}</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[s.liftWeight, { color: colors.primary }]}>{lift.maxWeightKg} kg × {lift.repsAtMax}</Text>
                  <Text style={[s.liftDate, { color: colors.textSecondary }]}>{new Date(lift.achievedAt).toLocaleDateString()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Privacy notice */}
        {sharesNothing && (
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: "center" }]}>
            <Ionicons name="lock-closed-outline" size={32} color={colors.textLight} style={{ marginBottom: spacing.sm }} />
            <Text style={[s.cardTitle, { color: colors.textSecondary, textAlign: "center" }]}>
              {friend.displayName} hasn't shared any stats yet
            </Text>
            <Text style={{ fontSize: font.sm, color: colors.textLight, textAlign: "center", marginTop: 4 }}>
              They can enable sharing in their Settings → Privacy
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1 },
    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing.lg, paddingVertical: 12,
      borderBottomWidth: 1, gap: spacing.sm,
    },
    backBtn: { padding: 4 },
    headerName: { fontSize: font.sm, fontWeight: "700", marginTop: 2 },
    actionIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

    card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },
    cardTitle: { fontSize: font.base, fontWeight: "700" },

    planName: { fontSize: font.lg, fontWeight: "800" },
    badge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 12, fontWeight: "600" },

    statBox: { flex: 1, borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, alignItems: "center" },
    statVal: { fontSize: font.xl, fontWeight: "800" },
    statLbl: { fontSize: 11, marginTop: 2 },

    liftRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
    liftName: { fontSize: font.sm, fontWeight: "600", flex: 1 },
    liftWeight: { fontSize: font.sm, fontWeight: "700" },
    liftDate: { fontSize: 11, marginTop: 2 },
  });
}
