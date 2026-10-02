import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Modal,
  Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";
import TourTarget from "../../tour/TourTarget";

const TABS = ["Friends", "Messages", "FAQ"];

const FAQ_ITEMS = [
  { q: "How do I add a friend?",          a: "Go to the Friends tab, tap the search icon in the top right, then search by name — or by their full email address — and send a request." },
  { q: "Can friends see my weight?",       a: "Only if you allow it. Go to Settings → Privacy and toggle 'Share weight data'. Friends see your latest weight and BMI." },
  { q: "Can friends see my workouts?",     a: "Yes, if 'Share activity' is on in Settings → Privacy. They can see how many workouts you've completed this week." },
  { q: "How do I message a friend?",       a: "Tap any friend in your friends list, then tap the message icon on their card. You can only message accepted friends." },
  { q: "How do I remove a friend?",        a: "Tap the friend's card in your friends list and select 'Remove friend'." },
  { q: "Is my profile public?",            a: "By default your profile is visible to friends only. You can change this in Settings → Privacy to public or private." },
  { q: "Are messages secure?",             a: "Messages are stored securely on the server and only accessible to the sender and recipient. Conversations are private." },
  { q: "Can I cancel a friend request?",   a: "Yes — go to Friends, switch to the Pending tab, find the outgoing request and tap Cancel." },
];

function Avatar({ name, size = 42, color = "#8b5cf6" }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + "22",
      alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: color + "55" }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: "700", color }}>{initials}</Text>
    </View>
  );
}

const AVATAR_COLORS = ["#8b5cf6","#0ea5e9","#22c55e","#f97316","#ef4444","#ec4899","#f59e0b"];
function avatarColor(id) { return AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length]; }

export default function SocialScreen({ navigation }) {
  const { colors } = useTheme();
  const { auth }   = useAuth();
  const insets     = useSafeAreaInsets();
  const userId     = auth?.userId;

  const [activeTab, setActiveTab] = useState("Friends");

  // Friends
  const [friends, setFriends]           = useState([]);
  const [pending, setPending]           = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [pendingTab, setPendingTab]     = useState("accepted"); // accepted | pending

  // Search / add
  const [searchOpen, setSearchOpen]     = useState(false);
  const [searchQ, setSearchQ]           = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Messages inbox
  const [inbox, setInbox]               = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [unreadCount, setUnreadCount]   = useState(0);

  const s = useMemo(() => makeStyles(colors), [colors]);

  // ── Load friends + inbox on focus ──────────────────────────────────────────
  const loadFriends = useCallback(async () => {
    if (!userId) return;
    setFriendsLoading(true);
    try {
      const [fRes, pRes] = await Promise.all([
        apiClient.get(`/api/friends/user/${userId}`),
        apiClient.get(`/api/friends/requests/user/${userId}`),
      ]);
      setFriends(Array.isArray(fRes.data) ? fRes.data : []);
      setPending(Array.isArray(pRes.data) ? pRes.data : []);
    } catch {}
    finally { setFriendsLoading(false); }
  }, [userId]);

  const loadInbox = useCallback(async () => {
    if (!userId) return;
    setInboxLoading(true);
    try {
      const [iRes, uRes] = await Promise.all([
        apiClient.get(`/api/messages/inbox/${userId}`),
        apiClient.get(`/api/messages/unread/${userId}`),
      ]);
      setInbox(Array.isArray(iRes.data) ? iRes.data : []);
      setUnreadCount(uRes.data?.count ?? 0);
    } catch {}
    finally { setInboxLoading(false); }
  }, [userId]);

  useFocusEffect(useCallback(() => { loadFriends(); loadInbox(); }, [loadFriends, loadInbox]));

  // ── User search ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQ.trim() || searchQ.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await apiClient.get("/api/friends/search", { params: { userId, q: searchQ.trim() } });
        setSearchResults(Array.isArray(res.data) ? res.data : []);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQ, userId]);

  async function sendRequest(receiverId) {
    try {
      await apiClient.post("/api/friends/request", { senderId: userId, receiverId });
      setSearchResults(prev => prev.map(r => r.userId === receiverId ? { ...r, friendStatus: "PENDING_SENT" } : r));
      loadFriends();
    } catch {}
  }

  async function acceptRequest(requestId) {
    try {
      await apiClient.put(`/api/friends/${requestId}/accept`, null, { params: { userId } });
      loadFriends();
    } catch {}
  }

  async function declineRequest(requestId) {
    try {
      await apiClient.put(`/api/friends/${requestId}/decline`, null, { params: { userId } });
      loadFriends();
    } catch {}
  }

  function openConversation(friend) {
    navigation.navigate("Conversation", {
      friendId:   friend.userId,
      friendName: friend.displayName,
    });
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  function renderFriendCard(friend) {
    const col = avatarColor(friend.userId);
    return (
      <TouchableOpacity
        key={friend.requestId}
        style={s.friendCard}
        onPress={() => navigation.navigate("FriendProfile", { friend })}
        activeOpacity={0.8}
      >
        <Avatar name={friend.displayName} color={col} />
        <View style={{ flex: 1 }}>
          <Text style={s.friendName}>{friend.displayName}</Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 3 }}>
            {friend.shareWeight && friend.latestWeightKg != null && (
              <Text style={s.friendStat}>⚖️ {friend.latestWeightKg.toFixed(1)} kg</Text>
            )}
            {friend.shareActivity && friend.workoutsThisWeek != null && (
              <Text style={s.friendStat}>🏋️ {friend.workoutsThisWeek} workouts</Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[s.msgIconBtn, { backgroundColor: col + "18" }]}
          onPress={() => openConversation(friend)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chatbubble-outline" size={18} color={col} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  function renderPendingCard(req) {
    const col = avatarColor(req.userId);
    const isIncoming = req.direction === "INCOMING";
    return (
      <View key={req.requestId} style={s.friendCard}>
        <Avatar name={req.displayName} color={col} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={s.friendName}>{req.displayName}</Text>
          <Text style={[s.friendStat, { color: isIncoming ? "#f59e0b" : colors.textSecondary }]}>
            {isIncoming ? "Wants to be friends" : "Request sent"}
          </Text>
        </View>
        {isIncoming ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={s.acceptBtn} onPress={() => acceptRequest(req.requestId)}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.declineBtn} onPress={() => declineRequest(req.requestId)}>
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.declineBtn} onPress={() => declineRequest(req.requestId)}>
            <Text style={{ fontSize: 11, color: "#fff", fontWeight: "700" }}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function renderInboxRow(msg) {
    const isMe = msg.senderId === userId;
    const otherId   = isMe ? msg.receiverId : msg.senderId;
    const otherName = isMe ? msg.receiverName : msg.senderName;
    const col       = avatarColor(otherId);
    const unread    = !isMe && !msg.readAt;
    return (
      <TouchableOpacity
        key={msg.id}
        style={s.inboxRow}
        onPress={() => navigation.navigate("Conversation", { friendId: otherId, friendName: otherName })}
        activeOpacity={0.8}
      >
        <Avatar name={otherName} color={col} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={[s.inboxName, unread && { fontWeight: "800" }]}>{otherName}</Text>
          <Text style={[s.inboxPreview, unread && { color: colors.text }]} numberOfLines={1}>
            {isMe ? "You: " : ""}{msg.content}
          </Text>
        </View>
        {unread && <View style={[s.unreadDot, { backgroundColor: colors.primary }]} />}
      </TouchableOpacity>
    );
  }

  // ── Tab content ────────────────────────────────────────────────────────────
  function renderFriendsTab() {
    const incomingPending = pending.filter(r => r.direction === "INCOMING");
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }} showsVerticalScrollIndicator={false}>
        {/* Pending requests banner */}
        {incomingPending.length > 0 && (
          <TouchableOpacity style={s.pendingBanner} onPress={() => setPendingTab("pending")}>
            <Ionicons name="person-add-outline" size={18} color="#f59e0b" />
            <Text style={s.pendingBannerText}>
              {incomingPending.length} friend request{incomingPending.length > 1 ? "s" : ""} waiting
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#f59e0b" />
          </TouchableOpacity>
        )}

        {/* Sub-tab: accepted / pending */}
        <View style={s.subTabs}>
          {["accepted", "pending"].map(t => (
            <TouchableOpacity key={t} style={[s.subTab, pendingTab === t && s.subTabOn]}
              onPress={() => setPendingTab(t)}>
              <Text style={[s.subTabText, pendingTab === t && s.subTabTextOn]}>
                {t === "accepted" ? `Friends (${friends.length})` : `Pending (${pending.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {friendsLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />}

        {pendingTab === "accepted" && !friendsLoading && (
          friends.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="people-outline" size={40} color={colors.textLight} />
              <Text style={s.emptyTitle}>No friends yet</Text>
              <Text style={s.emptySub}>Tap the + button to search and add friends</Text>
            </View>
          ) : friends.map(renderFriendCard)
        )}

        {pendingTab === "pending" && !friendsLoading && (
          pending.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="time-outline" size={40} color={colors.textLight} />
              <Text style={s.emptyTitle}>No pending requests</Text>
            </View>
          ) : pending.map(renderPendingCard)
        )}
      </ScrollView>
    );
  }

  function renderMessagesTab() {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 2 }} showsVerticalScrollIndicator={false}>
        {inboxLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />}
        {!inboxLoading && inbox.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.textLight} />
            <Text style={s.emptyTitle}>No messages yet</Text>
            <Text style={s.emptySub}>Message a friend from their card in the Friends tab</Text>
          </View>
        )}
        {inbox.map(renderInboxRow)}
      </ScrollView>
    );
  }

  function renderFAQTab() {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }} showsVerticalScrollIndicator={false}>
        <Text style={[s.faqHeading, { color: colors.text }]}>Frequently Asked Questions</Text>
        {FAQ_ITEMS.map((item, i) => (
          <FAQItem key={i} item={item} colors={colors} s={s} />
        ))}
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: colors.background }]} edges={[]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + spacing.sm }]}>
        <Text style={[s.headerTitle, { color: colors.text }]}>Social</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {unreadCount > 0 && activeTab !== "Messages" && (
            <View style={[s.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={s.unreadBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => { setSearchQ(""); setSearchResults([]); setSearchOpen(true); }}
          >
            <Ionicons name="person-add-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar */}
      <View style={[s.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[s.tab, activeTab === t && s.tabOn]} onPress={() => setActiveTab(t)}>
            <Text style={[s.tabText, { color: activeTab === t ? colors.primary : colors.textSecondary }]}>
              {t}
              {t === "Messages" && unreadCount > 0 ? ` (${unreadCount})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <TourTarget tourKey="social_home" style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {activeTab === "Friends"  && renderFriendsTab()}
          {activeTab === "Messages" && renderMessagesTab()}
          {activeTab === "FAQ"      && renderFAQTab()}
        </View>
      </TourTarget>

      {/* ── Search / Add Friends Modal ─────────────────────────────────────── */}
      <Modal visible={searchOpen} transparent animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[s.searchOverlay, { paddingBottom: insets.bottom }]}>
            <View style={[s.searchSheet, { backgroundColor: colors.surface }]}>
              <View style={[s.searchBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[s.searchInput, { color: colors.text }]}
                  value={searchQ}
                  onChangeText={setSearchQ}
                  placeholder="Search by name or full email…"
                  placeholderTextColor={colors.textSecondary}
                  autoFocus
                />
                {searchQ ? (
                  <TouchableOpacity onPress={() => setSearchQ("")}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {searchLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />}

              <ScrollView style={{ maxHeight: 360 }}>
                {!searchLoading && searchQ.length >= 2 && searchResults.length === 0 && (
                  <View style={{ marginTop: spacing.lg, gap: 4 }}>
                    <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: font.sm }}>
                      No users found for "{searchQ}"
                    </Text>
                    <Text style={{ color: colors.textLight, textAlign: "center", fontSize: 11 }}>
                      Try their display name, or type their full email address.
                    </Text>
                  </View>
                )}
                {searchResults.map(user => {
                  const col = avatarColor(user.userId);
                  const status = user.friendStatus;
                  return (
                    <View key={user.userId} style={s.searchRow}>
                      <Avatar name={user.displayName} color={col} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.friendName, { color: colors.text }]}>{user.displayName}</Text>
                        {/* Server sends the address partially hidden — never the full one. */}
                        {user.email ? (
                          <Text style={{ fontSize: 11, color: colors.textSecondary }}>{user.email}</Text>
                        ) : null}
                      </View>
                      {status === "ACCEPTED" ? (
                        <View style={s.alreadyFriendBadge}>
                          <Ionicons name="checkmark" size={13} color="#22c55e" />
                          <Text style={{ fontSize: 11, color: "#22c55e", fontWeight: "700" }}>Friends</Text>
                        </View>
                      ) : status === "PENDING_SENT" ? (
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>Pending…</Text>
                      ) : status === "PENDING_RECEIVED" ? (
                        <TouchableOpacity style={s.acceptBtn} onPress={() => {
                          // find the pending request and accept it
                          const pr = pending.find(p => p.userId === user.userId);
                          if (pr) { acceptRequest(pr.requestId); setSearchOpen(false); }
                        }}>
                          <Text style={{ fontSize: 11, color: "#fff", fontWeight: "700" }}>Accept</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]}
                          onPress={() => sendRequest(user.userId)}>
                          <Ionicons name="add" size={16} color="#fff" />
                          <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>Add</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              <TouchableOpacity style={[s.closeSearchBtn, { borderColor: colors.border }]}
                onPress={() => setSearchOpen(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: font.base, fontWeight: "600" }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

function FAQItem({ item, colors, s }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      style={[s.faqItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => setOpen(v => !v)}
      activeOpacity={0.8}
    >
      <View style={s.faqRow}>
        <Text style={[s.faqQ, { color: colors.text, flex: 1 }]}>{item.q}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
      </View>
      {open && <Text style={[s.faqA, { color: colors.textSecondary }]}>{item.a}</Text>}
    </TouchableOpacity>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1 },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.lg, paddingVertical: 12,
      borderBottomWidth: 1,
    },
    headerTitle: { fontSize: font.xl, fontWeight: "800" },
    headerBtn:   { padding: 6 },

    tabBar: {
      flexDirection: "row", borderBottomWidth: 1,
    },
    tab: {
      flex: 1, paddingVertical: 12, alignItems: "center",
      borderBottomWidth: 2, borderBottomColor: "transparent",
    },
    tabOn:     { borderBottomColor: colors.primary },
    tabText:   { fontSize: font.sm, fontWeight: "600" },

    subTabs: {
      flexDirection: "row", backgroundColor: colors.background,
      borderRadius: radius.lg, padding: 3, gap: 3, marginBottom: 4,
    },
    subTab:      { flex: 1, paddingVertical: 8, borderRadius: radius.md, alignItems: "center" },
    subTabOn:    { backgroundColor: colors.primary },
    subTabText:  { fontSize: font.sm, fontWeight: "600", color: colors.textSecondary },
    subTabTextOn:{ color: "#fff" },

    pendingBanner: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: "#fffbeb", borderRadius: radius.lg, padding: 12,
      borderWidth: 1, borderColor: "#fde68a",
    },
    pendingBannerText: { flex: 1, fontSize: font.sm, fontWeight: "600", color: "#92400e" },

    friendCard: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: colors.surface, borderRadius: radius.lg,
      padding: spacing.md, marginBottom: spacing.sm,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    },
    friendName: { fontSize: font.base, fontWeight: "700", color: colors.text },
    friendStat: { fontSize: 11, color: colors.textSecondary },
    msgIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

    acceptBtn:  { backgroundColor: "#22c55e", borderRadius: radius.md, paddingVertical: 7, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 4 },
    declineBtn: { backgroundColor: "#ef4444", borderRadius: radius.md, paddingVertical: 7, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 4 },
    addBtn:     { borderRadius: radius.md, paddingVertical: 7, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 4 },

    inboxRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    inboxName:    { fontSize: font.sm, fontWeight: "700", color: colors.text },
    inboxPreview: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    unreadDot:    { width: 10, height: 10, borderRadius: 5 },
    unreadBadge:  { borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
    unreadBadgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },

    empty: { alignItems: "center", paddingVertical: 48, gap: 10 },
    emptyTitle: { fontSize: font.base, fontWeight: "700", color: colors.textSecondary },
    emptySub:   { fontSize: font.sm, color: colors.textLight, textAlign: "center" },

    // Search modal
    searchOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    searchSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, gap: spacing.md, maxHeight: "80%" },
    searchBar: {
      flexDirection: "row", alignItems: "center", gap: 8,
      borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    },
    searchInput: { flex: 1, fontSize: font.base },
    searchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    alreadyFriendBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
    closeSearchBtn: { alignItems: "center", paddingVertical: 13, borderWidth: 1, borderRadius: radius.lg, marginTop: 4 },

    // FAQ
    faqHeading: { fontSize: font.lg, fontWeight: "800", marginBottom: 4 },
    faqItem:    { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
    faqRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
    faqQ:       { fontSize: font.sm, fontWeight: "700", lineHeight: 20 },
    faqA:       { fontSize: font.sm, lineHeight: 20, marginTop: spacing.sm },
  });
}
