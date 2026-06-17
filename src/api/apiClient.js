import axios from "axios";
import { DeviceEventEmitter } from "react-native";
import { clearAuth, getTokenSync } from "../auth/authStorage";
import { API_BASE_URL } from "../config";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = getTokenSync();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// When the server returns 401 (token expired or invalid), clear stored auth
// and emit an event so AuthContext can reset state and send user to login.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    // Don't auto-logout on auth endpoints (wrong password, etc.)
    const isAuthEndpoint = url.includes("/api/auth/");
    if (status === 401 && !isAuthEndpoint) {
      clearAuth();
      DeviceEventEmitter.emit("sff_auth_expired");
    }
    return Promise.reject(error);
  }
);

export default apiClient;
