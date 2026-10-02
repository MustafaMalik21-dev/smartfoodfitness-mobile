import { useCallback, useRef, useState } from "react";
import {
  FlatList, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../auth/useAuth";
import { useTheme } from "../../ThemeContext";
import { font, radius, spacing } from "../../theme";
import TourTarget from "../../tour/TourTarget";
import { devLog } from "../../utils/devLog";

const SUGGESTIONS = [
  { icon: "restaurant-outline",  text: "What should I eat to hit my protein goal?" },
  { icon: "flame-outline",       text: "How many calories have I had today?" },
  { icon: "barbell-outline",     text: "Suggest a workout for today" },
  { icon: "body-outline",        text: "What does my BMI mean?" },
  { icon: "nutrition-outline",   text: "Give me a high-protein meal idea" },
  { icon: "help-circle-outline", text: "How do I log food with the camera?" },
];

const WELCOME = {
  id: "welcome",
  role: "assistant",
  text: "Hi! I'm your AI fitness and nutrition assistant. I can help with food choices, workout advice, understanding your data, or anything about the app. What would you like to know? 💪",
};

function TypingIndicator({ colors }) {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowAI]}>
      <View style={styles.avatar}>
        <Ionicons name="sparkles" size={11} color="#8b5cf6" />
      </View>
      <View style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.textSecondary, fontSize: 18, letterSpacing: 3 }}>• • •</Text>
      </View>
    </View>
  );
}

export default function ChatScreen({ navigation }) {
  const { colors } = useTheme();
  const { auth } = useAuth();
  const userId = auth?.userId;
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);

  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const showSuggestions = true;

  const send = useCallback(async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg = { id: `u_${Date.now()}`, role: "user", text: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build history for API — exclude the static welcome message
      const history = [...messages.filter((m) => m.id !== "welcome"), userMsg]
        .map((m) => ({ role: m.role, content: m.text }));

      const res = await apiClient.post("/api/ai/chat", { userId, messages: history });
      const reply = res.data?.reply?.trim() || "Sorry, I couldn't get a response. Try again.";
      setMessages((prev) => [...prev, { id: `a_${Date.now()}`, role: "assistant", text: reply }]);
    } catch (err) {
      const status = err?.response?.status;
      devLog("[Chat] API error — status:", status, "message:", err?.message);
      const errText = status === 404
        ? "Chat endpoint not found — restart the backend server."
        : status >= 500
        ? "Server error — check the backend logs."
        : "Could not reach the server — check your connection.";
      setMessages((prev) => [
        ...prev,
        { id: `e_${Date.now()}`, role: "assistant", text: errText },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, userId]);

  function renderMessage({ item }) {
    const isUser = item.role === "user";
    return (
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={11} color="#8b5cf6" />
          </View>
        )}
        <View style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.primary, borderColor: colors.primary }
            : { backgroundColor: colors.surface, borderColor: colors.border },
          isUser ? styles.bubbleUser : styles.bubbleAI,
        ]}>
          <Text style={[styles.bubbleText, { color: isUser ? "#fff" : colors.text }]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginRight: 4 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.headerIcon, { backgroundColor: "#8b5cf618" }]}>
          <Ionicons name="sparkles" size={18} color="#8b5cf6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>AI Assistant</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Food · Fitness · App help</Text>
        </View>
        {messages.length > 1 && (
          <TouchableOpacity
            onPress={() => setMessages([WELCOME])}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <TourTarget tourKey="chat_home" style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Message list */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.list, { paddingBottom: spacing.md }]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListFooterComponent={loading ? <TypingIndicator colors={colors} /> : null}
          keyboardDismissMode="on-drag"
        />

        {/* Suggestion chips — only shown on empty conversation */}
        {showSuggestions && (
          <View style={styles.suggestionsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsScroll}
            >
              {SUGGESTIONS.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => send(s.text)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={s.icon} size={13} color={colors.primary} />
                  <Text style={[styles.chipText, { color: colors.text }]}>{s.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
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
            placeholder="Ask me anything…"
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={600}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary }, (!input.trim() || loading) && styles.sendBtnOff]}
            onPress={() => send()}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="arrow-up" size={19} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      </TourTarget>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  header:  {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerIcon:  { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: font.base, fontWeight: "700" },
  headerSub:   { fontSize: 11, marginTop: 1 },

  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 10 },

  bubbleRow:     { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowAI:   { justifyContent: "flex-start" },

  avatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#8b5cf618",
    alignItems: "center", justifyContent: "center",
    marginBottom: 2,
  },

  bubble: {
    maxWidth: "78%", borderRadius: 18, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAI:   { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: font.sm, lineHeight: 21 },

  suggestionsWrap:   { paddingVertical: 8 },
  suggestionsScroll: { paddingHorizontal: spacing.lg, gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0,
  },
  chipText: { fontSize: 12, fontWeight: "600", flexShrink: 1 },

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
