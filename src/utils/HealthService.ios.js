/**
 * HealthService.ios.js  — iOS entry point.
 * Metro automatically picks this file on iOS builds.
 *
 * Re-exports HealthKitService functions under platform-agnostic names so
 * screens can import from "HealthService" without any Platform.OS checks.
 */
import { Linking } from "react-native";
import {
  HK_AVAILABLE,
  initHealthKit,
  getHKStatus,
  resetHKInit,
  getTodaySteps,
  getTodayCalories,
  getLatestHeartRate,
  getDailySteps,
  getDailyCalories,
  getHeartRateSamples,
} from "./HealthKitService";

export const HEALTH_AVAILABLE   = HK_AVAILABLE;
export const initHealth         = initHealthKit;
export const getHealthStatus    = getHKStatus;
export const resetHealthInit    = resetHKInit;
export { getTodaySteps, getTodayCalories, getLatestHeartRate, getDailySteps, getDailyCalories, getHeartRateSamples };

// Open iOS Health settings
export function openHealthSettings() {
  Linking.openURL("app-settings:");
}

// No-op on iOS — SDK is always bundled with the OS
export function openHealthConnectInstall() {}
