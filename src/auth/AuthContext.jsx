import { createContext, useEffect, useMemo, useState } from "react";
import apiClient from "../api/apiClient";
import { clearAuth, getAuth, setAuth as persistAuth, setMemoryCache } from "./authStorage";

export const AuthContext = createContext(null);

function coerceBool(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  return false;
}

export function AuthProvider({ children }) {
  const [auth, setAuthState] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    getAuth().then((saved) => {
      if (saved) {
        setMemoryCache(saved);
        setAuthState(saved);
      }
      setBootstrapped(true);
    });
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    if (auth) {
      setMemoryCache(auth);
      persistAuth(auth);
    } else {
      setMemoryCache(null);
      clearAuth();
    }
  }, [auth, bootstrapped]);

  const value = useMemo(() => {
    async function fetchProfileOnboardingComplete(userId, token) {
      const res = await apiClient.get(`/api/user-profile/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return coerceBool(res.data && res.data.onboardingComplete);
    }

    async function login(email, password) {
      const res = await apiClient.post("/api/auth/login", { email, password });
      const token = res.data.token;
      const next = {
        userId: res.data.userId,
        email: res.data.email,
        displayName: res.data.displayName,
        token,
        onboardingComplete: coerceBool(res.data.onboardingComplete),
      };
      setAuthState(next);
      if (next.userId && token && next.onboardingComplete !== true) {
        try {
          const oc = await fetchProfileOnboardingComplete(next.userId, token);
          if (oc === true) {
            const updated = { ...next, onboardingComplete: true };
            setAuthState(updated);
            return updated;
          }
        } catch {}
      }
      return next;
    }

    async function register(displayName, email, password) {
      const res = await apiClient.post("/api/auth/register", { displayName, email, password });
      const next = {
        userId: res.data.userId,
        email: res.data.email,
        displayName: res.data.displayName,
        token: res.data.token,
        onboardingComplete: coerceBool(res.data.onboardingComplete),
      };
      setAuthState(next);
      return next;
    }

    function logout() {
      setAuthState(null);
      clearAuth();
    }

    function setAuth(next) {
      setAuthState(next);
    }

    return {
      auth,
      bootstrapped,
      isAuthenticated: !!(auth && auth.token),
      login,
      register,
      logout,
      setAuth,
    };
  }, [auth, bootstrapped]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
