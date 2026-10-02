// Production backend (Railway)
export const API_BASE_URL = "https://smartfoodfitness-production.up.railway.app";

// To run against a backend on your own machine, swap the line above for your
// laptop's LAN address (`ipconfig` -> IPv4) and rebuild or reload via Metro:
//   export const API_BASE_URL = "http://192.168.1.116:8080";
// Android blocks cleartext HTTP in release builds, so a local http:// URL also
// needs "usesCleartextTraffic": true under expo-build-properties in app.json.

// NOTE: Never put API keys in this file. Anything bundled with the app can be
// extracted from the APK/IPA. All AI calls go through the backend (/api/ai/*),
// which holds the Anthropic key as a server-side environment variable.
