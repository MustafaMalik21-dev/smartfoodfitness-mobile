import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ── Android channel ──────────────────────────────────────────────────────────
export async function setupNotificationChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("sff-reminders", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#8b5cf6",
    });
  }
}

// ── Permission ───────────────────────────────────────────────────────────────
export async function requestNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const { status: newStatus } = await Notifications.requestPermissionsAsync();
  return newStatus === "granted";
}

// ── Notification definitions (fixed identifiers so we can cancel by name) ───
const DEFS = {
  workouts: {
    id: "sff_workout_daily",
    title: "Time to work out! 💪",
    body: "Check your plan and stay on track today.",
    hour: 8,
    minute: 0,
  },
  food: {
    id: "sff_food_daily",
    title: "Don't forget to log your meals! 🍽️",
    body: "Track your food to hit your nutrition goals.",
    hour: 14,
    minute: 0,
  },
  streak: {
    id: "sff_streak_daily",
    title: "Keep your streak alive! 🔥",
    body: "Log something today — your streak is on the line.",
    hour: 20,
    minute: 0,
  },
};

async function scheduleOne(type) {
  const def = DEFS[type];
  if (!def) return;
  // Cancel first to avoid duplicates if called twice
  try { await Notifications.cancelScheduledNotificationAsync(def.id); } catch {}
  await Notifications.scheduleNotificationAsync({
    identifier: def.id,
    content: { title: def.title, body: def.body, sound: true },
    trigger: { hour: def.hour, minute: def.minute, repeats: true },
  });
}

async function cancelOne(type) {
  const def = DEFS[type];
  if (!def) return;
  try { await Notifications.cancelScheduledNotificationAsync(def.id); } catch {}
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Schedule or cancel each notification type based on settings.
 * Requests OS permission if not already granted.
 * Returns true if permission granted, false if denied.
 */
export async function syncLocalNotifications(notificationSettings) {
  const granted = await requestNotificationPermission();
  if (!granted) {
    // No permission — cancel everything so stale schedules don't linger
    await Promise.all(Object.keys(DEFS).map(cancelOne));
    return false;
  }
  await Promise.all(
    Object.entries(notificationSettings).map(([type, enabled]) =>
      enabled ? scheduleOne(type) : cancelOne(type)
    )
  );
  return true;
}

/**
 * Re-apply schedules on startup WITHOUT prompting for permission.
 * Only runs if permission was already granted in a previous session.
 */
export async function restoreLocalNotifications(notificationSettings) {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;
  await Promise.all(
    Object.entries(notificationSettings).map(([type, enabled]) =>
      enabled ? scheduleOne(type) : cancelOne(type)
    )
  );
}
