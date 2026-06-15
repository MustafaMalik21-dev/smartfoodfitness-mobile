/**
 * HealthKitService.js
 *
 * Accesses NativeModules.AppleHealthKit directly instead of going through the
 * react-native-health wrapper. The wrapper uses Object.assign() which drops
 * prototype-chain methods under the New Architecture — NativeModules is the
 * authoritative source.
 */
import { NativeModules, Platform } from "react-native";

// ── Native module reference ───────────────────────────────────────────────────
let HK = null;
export let HK_AVAILABLE = false;

if (Platform.OS === "ios") {
  HK = NativeModules.AppleHealthKit ?? null;
  HK_AVAILABLE = typeof HK?.initHealthKit === "function";
  console.log("[HealthKit] NativeModules.AppleHealthKit:",
    HK ? "present" : "MISSING",
    "| HK_AVAILABLE:", HK_AVAILABLE);
}

// Permission string constants (from react-native-health/src/constants/Permissions.js)
const P = {
  Steps:              "Steps",
  ActiveEnergyBurned: "ActiveEnergyBurned",
  HeartRate:          "HeartRate",
  RestingHeartRate:   "RestingHeartRate",
};

// ── Permission / init state ───────────────────────────────────────────────────
let _permStatus  = "idle";   // "idle" | "granted" | "denied"
let _initPromise = null;

export function initHealthKit() {
  if (!HK_AVAILABLE) return Promise.resolve(false);
  if (_initPromise)  return _initPromise;

  _initPromise = new Promise((resolve) => {
    HK.initHealthKit(
      { permissions: { read: [P.Steps, P.ActiveEnergyBurned, P.HeartRate, P.RestingHeartRate], write: [] } },
      (err) => {
        if (err) {
          console.log("[HealthKit] initHealthKit error:", err);
          _permStatus = "denied";
          resolve(false);
        } else {
          console.log("[HealthKit] permissions granted ✓");
          _permStatus = "granted";
          resolve(true);
        }
      },
    );
  });
  return _initPromise;
}

export function getHKStatus() { return _permStatus; }

export function resetHKInit() {
  _initPromise = null;
  _permStatus  = "idle";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Today snapshots ───────────────────────────────────────────────────────────

export async function getTodaySteps() {
  if (!HK_AVAILABLE || !(await initHealthKit())) return null;
  return new Promise((resolve) => {
    HK.getStepCount({ date: new Date().toISOString() }, (err, r) => {
      resolve(err ? null : Math.round(r?.value ?? 0));
    });
  });
}

export async function getTodayCalories() {
  if (!HK_AVAILABLE || !(await initHealthKit())) return null;
  return new Promise((resolve) => {
    HK.getActiveEnergyBurned(
      { startDate: daysAgo(0).toISOString(), endDate: new Date().toISOString(), includeManuallyAdded: false },
      (err, results) => {
        if (err || !Array.isArray(results)) { resolve(null); return; }
        resolve(Math.round(results.reduce((s, r) => s + (r.value || 0), 0)));
      },
    );
  });
}

export async function getLatestHeartRate() {
  if (!HK_AVAILABLE || !(await initHealthKit())) return null;
  return new Promise((resolve) => {
    HK.getHeartRateSamples(
      { startDate: daysAgo(1).toISOString(), endDate: new Date().toISOString(), ascending: false, limit: 1 },
      (err, results) => {
        if (err || !results?.length) { resolve(null); return; }
        resolve({ value: Math.round(results[0].value), date: results[0].startDate });
      },
    );
  });
}

// ── Historical series ─────────────────────────────────────────────────────────

export async function getDailySteps(days = 365) {
  if (!HK_AVAILABLE || !(await initHealthKit())) return [];
  return new Promise((resolve) => {
    HK.getDailyStepCountSamples(
      { startDate: daysAgo(days).toISOString(), endDate: new Date().toISOString() },
      (err, results) => {
        if (err || !Array.isArray(results)) { resolve([]); return; }
        resolve(results.map((r) => ({ date: r.startDate.slice(0, 10), value: Math.round(r.value || 0) })));
      },
    );
  });
}

export async function getDailyCalories(days = 365) {
  if (!HK_AVAILABLE || !(await initHealthKit())) return [];
  return new Promise((resolve) => {
    HK.getActiveEnergyBurned(
      { startDate: daysAgo(days).toISOString(), endDate: new Date().toISOString(), includeManuallyAdded: false },
      (err, results) => {
        if (err || !Array.isArray(results)) { resolve([]); return; }
        const map = {};
        for (const r of results) {
          const key = r.startDate.slice(0, 10);
          map[key] = (map[key] || 0) + (r.value || 0);
        }
        resolve(Object.entries(map).map(([date, value]) => ({ date, value: Math.round(value) })));
      },
    );
  });
}

export async function getHeartRateSamples(days = 30) {
  if (!HK_AVAILABLE || !(await initHealthKit())) return [];
  return new Promise((resolve) => {
    HK.getHeartRateSamples(
      { startDate: daysAgo(days).toISOString(), endDate: new Date().toISOString(), ascending: true },
      (err, results) => {
        if (err || !Array.isArray(results)) { resolve([]); return; }
        resolve(results.map((r) => ({ date: r.startDate, value: Math.round(r.value || 0) })));
      },
    );
  });
}
