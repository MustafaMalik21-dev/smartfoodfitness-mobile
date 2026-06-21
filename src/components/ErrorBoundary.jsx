/**
 * ErrorBoundary.jsx
 *
 * Catches React rendering errors that would otherwise white-screen the app.
 * In dev mode: shows the full error + stack so you can debug immediately.
 * In production: shows a friendly message + a short error code the user can
 * read out to you (e.g. over WhatsApp) for remote diagnosis.
 */
import React from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

function shortCode(error) {
  // Produces a short alphanumeric fingerprint from the error message
  // e.g. "Cannot read property 'x' of undefined" → "E-4A3F"
  const msg = error?.message ?? "unknown";
  let hash = 0;
  for (let i = 0; i < msg.length; i++) {
    hash = (Math.imul(31, hash) + msg.charCodeAt(i)) | 0;
  }
  return "E-" + Math.abs(hash).toString(16).toUpperCase().slice(0, 4);
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Unhandled render error:", error.message);
    console.error("[ErrorBoundary] Component stack:", info?.componentStack);
    this.setState({ info });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, info } = this.state;
    const isDev = __DEV__;
    const code  = shortCode(error);

    return (
      <View style={s.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <Ionicons name="warning-outline" size={56} color="#ef4444" style={{ marginBottom: 16 }} />

        <Text style={s.title}>Something went wrong</Text>

        {isDev ? (
          /* ── Dev: show the full error ─────────────────────────────── */
          <ScrollView style={s.devBox} contentContainerStyle={{ padding: 12 }}>
            <Text style={s.devMsg}>{error?.message ?? "Unknown error"}</Text>
            {info?.componentStack ? (
              <Text style={s.devStack}>{info.componentStack}</Text>
            ) : null}
          </ScrollView>
        ) : (
          /* ── Production: friendly message + short code ────────────── */
          <>
            <Text style={s.sub}>
              The app ran into an unexpected problem.{"\n"}
              Share the code below with the developer so they can look into it.
            </Text>
            <View style={s.codeBox}>
              <Text style={s.codeLabel}>Error code</Text>
              <Text style={s.codeValue}>{code}</Text>
            </View>
          </>
        )}

        <TouchableOpacity style={s.btn} onPress={this.handleReset}>
          <Ionicons name="refresh-outline" size={18} color="#fff" />
          <Text style={s.btnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111",
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 4,
  },
  codeBox: {
    marginTop: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 4,
  },
  codeLabel: { fontSize: 11, fontWeight: "600", color: "#888", letterSpacing: 1 },
  codeValue: { fontSize: 28, fontWeight: "800", color: "#ef4444", letterSpacing: 3 },

  // Dev-only error box
  devBox: {
    width: "100%",
    maxHeight: 300,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    marginTop: 8,
  },
  devMsg:   { fontSize: 12, fontWeight: "700", color: "#dc2626", marginBottom: 8 },
  devStack: { fontSize: 10, color: "#7f1d1d", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ef4444",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
