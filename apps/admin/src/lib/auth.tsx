"use client";
/**
 * AuthProvider — client context for the admin session.
 *
 * Dev/mock-mode flow: POST /auth/dev/token with { uid, email, displayName, provider: "dev" }
 * → stores token + principal in sessionStorage → role-aware UI everywhere below.
 * When the API has Firebase configured (403/503 from dev/token, or mode.authentication ===
 * "firebase") the login screen shows an honest setup notice instead of pretending dev login
 * works — admin sign-in via Firebase ID token is documented in docs/environment-setup.md.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  API_BASE,
  apiGet,
  apiPost,
  clearSession,
  getStoredPrincipal,
  getToken,
  setSession,
  type DevLoginResponse,
} from "./api";
import type { AuthPrincipal } from "./types";

interface PlatformMode {
  dataProvider?: string;
  authentication?: string;
  payments?: string;
  razorpayConfigured?: boolean;
  cloudinaryConfigured?: boolean;
  sandbox?: boolean;
}

interface AuthContextValue {
  /** null until the session has been restored from sessionStorage on mount. */
  principal: AuthPrincipal | null;
  ready: boolean;
  mode: PlatformMode | null;
  loginDev: (input: { uid: string; email?: string; displayName?: string }) => Promise<AuthPrincipal>;
  logout: () => void;
  refreshMode: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [principal, setPrincipal] = useState<AuthPrincipal | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<PlatformMode | null>(null);

  // Restore an existing session (client-only; sessionStorage does not exist on the server).
  useEffect(() => {
    const stored = getStoredPrincipal();
    if (stored && getToken()) setPrincipal(stored);
    setReady(true);
  }, []);

  const refreshMode = useCallback(async () => {
    try {
      const status = await apiGet<{ mode?: PlatformMode }>("/auth/platform-status");
      if (status?.mode) setMode(status.mode);
    } catch {
      setMode(null);
    }
  }, []);

  const loginDev = useCallback(
    async (input: { uid: string; email?: string; displayName?: string }) => {
      const data = await apiPost<DevLoginResponse>("/auth/dev/token", {
        uid: input.uid,
        email: input.email || undefined,
        displayName: input.displayName || undefined,
        provider: "dev",
      });
      if (data.mode) setMode(data.mode);
      const staffPrincipal = data.principal;
      setSession(data.token, staffPrincipal);
      setPrincipal(staffPrincipal);
      return staffPrincipal;
    },
    [],
  );

  const logout = useCallback(() => {
    clearSession();
    setPrincipal(null);
  }, []);

  const value = useMemo(
    () => ({ principal, ready, mode, loginDev, logout, refreshMode }),
    [principal, ready, mode, loginDev, logout, refreshMode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export { API_BASE };
