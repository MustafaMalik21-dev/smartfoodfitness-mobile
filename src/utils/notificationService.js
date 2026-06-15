import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

const KEY = (uid) => `sff_notifications_${uid}`;
const MAX = 100;

export async function postNotification(userId, type, title, message) {
  if (!userId) return;
  try {
    const raw = await AsyncStorage.getItem(KEY(userId));
    const existing = raw ? JSON.parse(raw) : [];
    const entry = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      notificationType: type,
      title,
      message,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    const updated = [entry, ...existing].slice(0, MAX);
    await AsyncStorage.setItem(KEY(userId), JSON.stringify(updated));
    DeviceEventEmitter.emit("sff_notification_new");
  } catch {}
}

export async function getNotifications(userId) {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(KEY(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function markNotificationRead(userId, id) {
  if (!userId || !id) return;
  try {
    const raw = await AsyncStorage.getItem(KEY(userId));
    const items = raw ? JSON.parse(raw) : [];
    const updated = items.map((n) => n.id === id ? { ...n, isRead: true } : n);
    await AsyncStorage.setItem(KEY(userId), JSON.stringify(updated));
  } catch {}
}

export async function markAllNotificationsRead(userId) {
  if (!userId) return;
  try {
    const raw = await AsyncStorage.getItem(KEY(userId));
    const items = raw ? JSON.parse(raw) : [];
    const updated = items.map((n) => ({ ...n, isRead: true }));
    await AsyncStorage.setItem(KEY(userId), JSON.stringify(updated));
  } catch {}
}
