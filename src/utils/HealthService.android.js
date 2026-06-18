/**
 * HealthService.android.js  — Android entry point.
 * Metro automatically picks this file on Android builds.
 *
 * Re-exports AndroidHealthService under the same names as HealthService.ios.js
 * so screens are fully platform-agnostic.
 */
export {
  HEALTH_AVAILABLE,
  initHealth,
  getHealthStatus,
  resetHealthInit,
  openHealthSettings,
  openHealthConnectInstall,
  getTodaySteps,
  getTodayCalories,
  getLatestHeartRate,
  getDailySteps,
  getDailyCalories,
  getHeartRateSamples,
} from "./AndroidHealthService";
