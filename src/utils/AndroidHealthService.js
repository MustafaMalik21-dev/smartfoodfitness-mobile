/**
 * AndroidHealthService.js
 *
 * Android Health Connect integration — mirrors the HealthKitService API so
 * screens can import from HealthService (platform-specific file) without
 * any platform checks in the component code.
 *
 * Health Connect aggregates data from Samsung Health, Google Fit, Fitbit,
 * and other apps that the user has synced to it (pre-installed on Android 14+,
 * available as a Play Store app on Android 9+).
 */
import { Linking, Platform } from "react-native";
import { devLog, devWarn } from "./devLog";

// ── Safe import of react-native-health-connect ────────────────────────────────
// With New Architecture (TurboModules), importing an unregistered native module
// throws immediately. Wrap with require() + try/catch so the app doesn't crash
// when running in Expo Go or a dev client built before this module was added.
let HC = null;
let _moduleAvailable = false;
try {
  HC = require("react-native-health-connect");
  _moduleAvailable = true;
} catch (e) {
  devWarn("[AndroidHealth] react-native-health-connect not available:", e.message);
}

const getSdkStatus           = HC?.getSdkStatus;
const initialize             = HC?.initialize;
const requestPermission      = HC?.requestPermission;
const getGrantedPermissions  = HC?.getGrantedPermissions;
const readRecords            = HC?.readRecords;
const openHealthConnectSettings = HC?.openHealthConnectSettings;
const SdkAvailabilityStatus  = HC?.SdkAvailabilityStatus ?? { SDK_AVAILABLE: 3 };

// ── Availability flag ─────────────────────────────────────────────────────────
export let HEALTH_AVAILABLE = Platform.OS === "android" && _moduleAvailable;

// ── Permission / init state ───────────────────────────────────────────────────
// "idle" | "requesting" | "granted" | "denied" | "sdk_unavailable" | "sdk_update_required"
let _permStatus  = "idle";
let _initPromise = null;

export function getHealthStatus() { return _permStatus; }

export function resetHealthInit() {
  _initPromise = null;
  _permStatus  = "idle";
}

// Open Health Connect settings (for "denied" state)
export function openHealthSettings() {
  if (openHealthConnectSettings) {
    openHealthConnectSettings();
  }
}

// Open Play Store to install Health Connect (for "sdk_unavailable" state)
export function openHealthConnectInstall() {
  Linking.openURL(
    "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata"
  ).catch(() => {
    Linking.openURL(
      "market://details?id=com.google.android.apps.healthdata"
    ).catch(() => {});
  });
}

const PERMISSIONS = [
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "ActiveCaloriesBurned" },
  { accessType: "read", recordType: "HeartRate" },
];

// ── Init & permission request ─────────────────────────────────────────────────
export function initHealth() {
  if (!_moduleAvailable) {
    _permStatus = "sdk_unavailable";
    return Promise.resolve(false);
  }

  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      // 1. Check if Health Connect SDK is available on this device
      //    SDK_UNAVAILABLE (1) = not installed; SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED (2) = needs update
      const sdkStatus = await getSdkStatus();
      if (sdkStatus !== SdkAvailabilityStatus.SDK_AVAILABLE) {
        const needsUpdate = sdkStatus === (SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ?? 2);
        devLog("[AndroidHealth] SDK not available, status:", sdkStatus, needsUpdate ? "(needs update)" : "(not installed)");
        _permStatus = needsUpdate ? "sdk_update_required" : "sdk_unavailable";
        return false;
      }

      // 2. Initialize SDK
      await initialize();

      // 3. Check if permissions are already granted (avoids redundant dialog)
      const existing = await getGrantedPermissions();
      const alreadyHasAny = existing.some(
        (p) =>
          ["Steps", "ActiveCaloriesBurned", "HeartRate"].includes(p.recordType) &&
          p.accessType === "read"
      );
      if (alreadyHasAny) {
        devLog("[AndroidHealth] permissions already granted ✓");
        _permStatus = "granted";
        return true;
      }

      // 4. Request permissions — opens Health Connect UI
      const granted = await requestPermission(PERMISSIONS);
      const hasAny = granted.some(
        (p) =>
          ["Steps", "ActiveCaloriesBurned", "HeartRate"].includes(p.recordType)
      );

      if (hasAny) {
        devLog("[AndroidHealth] permissions granted ✓");
        _permStatus = "granted";
        return true;
      } else {
        devLog("[AndroidHealth] permissions denied");
        _permStatus = "denied";
        return false;
      }
    } catch (e) {
      devLog("[AndroidHealth] initHealth error:", e);
      _permStatus = "denied";
      return false;
    }
  })();

  return _initPromise;
}

// ── Energy unit helper ────────────────────────────────────────────────────────
function toKcal(energy) {
  if (!energy) return 0;
  const { value = 0, unit = "kilocalories" } = energy;
  if (unit === "kilocalories") return value;
  if (unit === "calories")     return value / 1000;
  if (unit === "joules")       return value / 4184;
  if (unit === "kilojoules")   return value / 4.184;
  return value;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function nowISO() { return new Date().toISOString(); }

// ── Today snapshots ───────────────────────────────────────────────────────────

export async function getTodaySteps() {
  if (!(await initHealth())) return null;
  try {
    const { records } = await readRecords("Steps", {
      timeRangeFilter: { operator: "between", startTime: todayStart(), endTime: nowISO() },
    });
    return records.reduce((sum, r) => sum + (r.count || 0), 0);
  } catch { return null; }
}

export async function getTodayCalories() {
  if (!(await initHealth())) return null;
  try {
    const { records } = await readRecords("ActiveCaloriesBurned", {
      timeRangeFilter: { operator: "between", startTime: todayStart(), endTime: nowISO() },
    });
    return Math.round(records.reduce((sum, r) => sum + toKcal(r.energy), 0));
  } catch { return null; }
}

export async function getLatestHeartRate() {
  if (!(await initHealth())) return null;
  try {
    const { records } = await readRecords("HeartRate", {
      timeRangeFilter: { operator: "between", startTime: daysAgoISO(1), endTime: nowISO() },
    });
    let latest = null;
    for (const r of records) {
      for (const s of (r.samples || [])) {
        if (!latest || s.time > latest.date) {
          latest = { value: Math.round(s.beatsPerMinute), date: s.time };
        }
      }
    }
    return latest;
  } catch { return null; }
}

// ── Historical series ─────────────────────────────────────────────────────────

export async function getDailySteps(days = 365) {
  if (!(await initHealth())) return [];
  try {
    const { records } = await readRecords("Steps", {
      timeRangeFilter: { operator: "between", startTime: daysAgoISO(days), endTime: nowISO() },
    });
    const map = {};
    for (const r of records) {
      const key = r.startTime.slice(0, 10);
      map[key] = (map[key] || 0) + (r.count || 0);
    }
    return Object.entries(map).map(([date, value]) => ({ date, value: Math.round(value) }));
  } catch { return []; }
}

export async function getDailyCalories(days = 365) {
  if (!(await initHealth())) return [];
  try {
    const { records } = await readRecords("ActiveCaloriesBurned", {
      timeRangeFilter: { operator: "between", startTime: daysAgoISO(days), endTime: nowISO() },
    });
    const map = {};
    for (const r of records) {
      const key = r.startTime.slice(0, 10);
      map[key] = (map[key] || 0) + toKcal(r.energy);
    }
    return Object.entries(map).map(([date, value]) => ({ date, value: Math.round(value) }));
  } catch { return []; }
}

export async function getHeartRateSamples(days = 30) {
  if (!(await initHealth())) return [];
  try {
    const { records } = await readRecords("HeartRate", {
      timeRangeFilter: { operator: "between", startTime: daysAgoISO(days), endTime: nowISO() },
    });
    const samples = [];
    for (const r of records) {
      for (const s of (r.samples || [])) {
        samples.push({ date: s.time, value: Math.round(s.beatsPerMinute) });
      }
    }
    return samples.sort((a, b) => a.date.localeCompare(b.date));
  } catch { return []; }
}
