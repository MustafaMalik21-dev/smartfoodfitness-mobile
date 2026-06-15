import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "sff_auth_v1";

// In-memory cache so apiClient interceptor can read synchronously
let _cache = null;

export async function getAuth() {
  if (_cache !== null) return _cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    _cache = raw ? JSON.parse(raw) : null;
    return _cache;
  } catch {
    return null;
  }
}

export async function setAuth(auth) {
  _cache = auth;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(auth));
  } catch {}
}

export async function clearAuth() {
  _cache = null;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}

export function getTokenSync() {
  return _cache && _cache.token ? _cache.token : "";
}

export function getUserIdSync() {
  return _cache && _cache.userId !== undefined ? _cache.userId : null;
}

export function setMemoryCache(auth) {
  _cache = auth;
}
