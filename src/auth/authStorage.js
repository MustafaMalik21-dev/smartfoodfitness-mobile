import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "sff_auth_v1";

// expo-secure-store is a native module. On a dev-client build made before it
// was added to the project, calls throw at runtime — guard the import like the
// BLE/HealthKit services do and fall back to AsyncStorage so login still works.
let SecureStore = null;
try {
  SecureStore = require("expo-secure-store");
} catch {
  SecureStore = null;
}

// In-memory cache so apiClient interceptor can read synchronously
let _cache = null;

async function readSecure() {
  if (!SecureStore) return null;
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

async function writeSecure(raw) {
  if (!SecureStore) return false;
  try {
    await SecureStore.setItemAsync(KEY, raw);
    return true;
  } catch {
    return false;
  }
}

async function deleteSecure() {
  if (!SecureStore) return;
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {}
}

export async function getAuth() {
  if (_cache !== null) return _cache;
  try {
    let raw = await readSecure();
    if (raw == null) {
      // Legacy location (or SecureStore unavailable). Migrate if possible.
      raw = await AsyncStorage.getItem(KEY);
      if (raw != null && (await writeSecure(raw))) {
        await AsyncStorage.removeItem(KEY);
      }
    }
    _cache = raw ? JSON.parse(raw) : null;
    return _cache;
  } catch {
    return null;
  }
}

export async function setAuth(auth) {
  _cache = auth;
  try {
    const raw = JSON.stringify(auth);
    if (await writeSecure(raw)) {
      // Remove any stale unencrypted copy from the legacy location
      await AsyncStorage.removeItem(KEY);
    } else {
      await AsyncStorage.setItem(KEY, raw);
    }
  } catch {}
}

export async function clearAuth() {
  _cache = null;
  try {
    await deleteSecure();
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
