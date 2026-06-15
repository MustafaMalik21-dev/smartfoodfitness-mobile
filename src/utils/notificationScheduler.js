import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../api/apiClient";
import { postNotification } from "./notificationService";

const KEY_LAST_FOOD_NOTIF    = "sff_notif_food_last";
const KEY_LAST_STREAK_NOTIF  = "sff_notif_streak_last";
const KEY_LAST_WORKOUT_NOTIF = "sff_notif_workout_last";
const LS_KEY = "sff_settings_v1";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

async function getLastNotifDate(key) {
  try { return (await AsyncStorage.getItem(key)) || ""; } catch { return ""; }
}

async function setLastNotifDate(key) {
  try { await AsyncStorage.setItem(key, todayStr()); } catch {}
}

export async function isNotifEnabled(type) {
  try {
    const raw = await AsyncStorage.getItem(LS_KEY);
    if (!raw) return true;
    return JSON.parse(raw)?.notifications?.[type] !== false;
  } catch { return true; }
}

export async function checkFoodReminder(userId) {
  if (!userId) return;
  if (!(await isNotifEnabled("food"))) return;
  const last = await getLastNotifDate(KEY_LAST_FOOD_NOTIF);
  if (last === todayStr()) return;
  const hour = new Date().getHours();
  if (hour < 14) return;
  try {
    const res = await apiClient.get(`/api/nutrition-logs/user/${userId}/today`);
    const logs = Array.isArray(res.data) ? res.data : [];
    if (logs.length === 0) {
      await postNotification(userId, "food", "Don't forget to log your meals!", "You haven't logged any food today. Keep your streak going.");
      await setLastNotifDate(KEY_LAST_FOOD_NOTIF);
    }
  } catch {}
}

export async function checkStreakReminder(userId) {
  if (!userId) return;
  if (!(await isNotifEnabled("streak"))) return;
  const last = await getLastNotifDate(KEY_LAST_STREAK_NOTIF);
  if (last === todayStr()) return;
  try {
    const res = await apiClient.get(`/api/workout-logs/user/${userId}/streak`, { params: { timezone: "Europe/London" } });
    const streak = res.data;
    if (streak && Number(streak.currentStreak) > 0) {
      const lastLog = streak.lastLogDate ? new Date(streak.lastLogDate) : null;
      if (!lastLog) return;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      lastLog.setHours(0, 0, 0, 0);
      const diff = Math.round((today - lastLog) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        await postNotification(userId, "streak", "Your streak is at risk! 🔥", `You're on a ${streak.currentStreak}-day streak. Log something today to keep it alive.`);
        await setLastNotifDate(KEY_LAST_STREAK_NOTIF);
      }
    }
  } catch {}
}

export async function checkWorkoutReminder(userId, scheduledWeekdays) {
  if (!userId || !scheduledWeekdays?.length) return;
  if (!(await isNotifEnabled("workouts"))) return;
  const last = await getLastNotifDate(KEY_LAST_WORKOUT_NOTIF);
  if (last === todayStr()) return;
  const todayDow = new Date().getDay();
  if (!scheduledWeekdays.includes(todayDow)) return;
  await postNotification(userId, "workout", "Workout day! 💪", "Today is a scheduled workout day. Keep up your routine.");
  await setLastNotifDate(KEY_LAST_WORKOUT_NOTIF);
}
