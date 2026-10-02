/**
 * devLog.js
 *
 * Diagnostic logging that only reaches the console in development builds.
 *
 * On Android every console.* call lands in logcat, which any app holding
 * READ_LOGS — and anyone with adb — can read. The BLE / Health Connect /
 * HealthKit diagnostics in this app print weight, impedance, height, age and
 * permission state, so they must stay out of release builds.
 *
 * __DEV__ is a Metro-injected global (false in production bundles), so the
 * bodies below are dead code once the release bundle is minified. Arguments
 * are still evaluated at the call site — keep expensive formatting inside an
 * `if (__DEV__)` block instead of passing it here.
 */

export function devLog(...args) {
  if (__DEV__) console.log(...args);
}

export function devWarn(...args) {
  if (__DEV__) console.warn(...args);
}
