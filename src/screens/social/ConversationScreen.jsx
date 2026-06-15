import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";

function formatTime(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ConversationScreen({ navigation, route }) {
  const { friendId, friendName } = route.params ?? {};
  const { colors }  = useTheme();
  const { auth }    = useAuth();
  const userId      = auth?.userId;
  const insets      = useSafeAreaInsets();
  const flatRef     = useRef(null);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);

  const load = useCallback(async () => {
    if (!userId || !friendId) return;
    try {
      const res = await apiClient.get("/api/messages/conversation", {
        params: { userA: userId, userB: friendId },
      });
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch {}
    finally { setLoading(false); }
  }, [userId, friendId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Poll every 5 s while screen is focused
  useEffect(() => {
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    try {
      await apiClient.post("/api/messages", {
        senderId: userId, receiverId: friendId, content: text,
      });
      load();
    } catch {}
    finally { setSending(false); }
  }

  function renderMessage({ item }) {
    const isMe = item.senderId === userId;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
        <View style={[
          styles.bubble,
          isMe
            ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
        ]}>
          <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.text }]}>
            {item.content}
          </Text>
          <Text style={[styles.bubbleTime, { color: isMe ? "rgba(255,255,255,0.65)" : colors.textSecondary }]}>
            {formatTime(item.sentAt)}
            {isMe && item.readAt ? "  ✓✓" : ""}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerName, { color: colors.text }]}>{friendName ?? "Message"}</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>End-to-end secured</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={m => String(m.id)}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubble-outline" size={36} color={colors.textLight} />
                <Text style={{ color: colors.textSecondary, fontSize: font.sm, marginTop: 8 }}>
                  No messages yet. Say hello!
                </Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View style={[
          styles.inputBar,
          { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom || spacing.md }
        ]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={input}
            onChangeText={setInput}
            placeholder="Message…"
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary }, (!input.trim() || sending) && styles.sendBtnOff]}
            onPress={send}
            disabled={!input.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="arrow-up" size={19} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn:    { width: 36 },
  headerName: { fontSize: font.base, fontWeight: "700" },
  headerSub:  { fontSize: 11, marginTop: 1 },

  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 6 },

  msgRow:     { marginBottom: 4 },
  msgRowMe:   { alignItems: "flex-end" },
  msgRowThem: { alignItems: "flex-start" },

  bubble: {
    maxWidth: "78%", borderRadius: 18, padding: 12,
  },
  bubbleText: { fontSize: font.sm, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 4, textAlign: "right" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },

  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: spacing.lg, paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1, borderWidth: 1, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: font.sm, maxHeight: 110, lineHeight: 20,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center", marginBottom: 1,
  },
  sendBtnOff: { opacity: 0.4 },
});
