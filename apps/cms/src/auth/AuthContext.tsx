import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import type { JwtClaims, TenantUserRole } from "@booking/shared-types";
import { SESSION_EXPIRED_EVENT } from "../lib/api.js";

const STORAGE_KEY = "booking_cms_token";

// setTimeout treats delays past ~24.8 days as 0 and fires immediately, so a
// far-future `exp` (or a clock skewed backwards) is capped rather than trusted.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

interface AuthContextValue {
  token: string | null;
  role: TenantUserRole | null;
  /** True when the session ended on its own rather than by signing out — lets
   *  the login screen explain why the user is suddenly back there. */
  sessionExpired: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Decoding client-side (rather than a /cms/auth/me endpoint) is UI-only
// convenience — hiding owner-only nav/routes for professionals, and knowing
// when to stop pretending we're signed in. The actual enforcement of R10 stays
// server-side via RolesGuard regardless of what this returns; a tampered or
// expired token is rejected by the API either way.
function decodeClaims(token: string): JwtClaims | null {
  try {
    return jwtDecode<JwtClaims>(token);
  } catch {
    return null;
  }
}

// `exp` is in seconds. Undecodable counts as expired: a token we can't read is
// one we can't reason about, and the API won't accept it either.
function isUsable(claims: JwtClaims | null): claims is JwtClaims {
  return claims !== null && claims.exp * 1000 > Date.now();
}

interface Session {
  token: string;
  claims: JwtClaims;
}

// Read at startup rather than trusting whatever is in storage: a token left
// behind from yesterday's 8-hour session must not render a logged-in shell
// whose every request 401s.
function restoreSession(): Session | null {
  const token = localStorage.getItem(STORAGE_KEY);
  if (!token) return null;

  const claims = decodeClaims(token);
  if (!isUsable(claims)) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return { token, claims };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(restoreSession);
  const [sessionExpired, setSessionExpired] = useState(false);

  const endSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setSessionExpired(true);
  }, []);

  const login = useCallback((newToken: string) => {
    const claims = decodeClaims(newToken);
    localStorage.setItem(STORAGE_KEY, newToken);
    setSessionExpired(false);
    setSession(claims ? { token: newToken, claims } : null);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    // Signing out deliberately isn't an expiry — no "session expired" notice.
    setSessionExpired(false);
  }, []);

  // The API is the authority on whether a token still works: it may be revoked
  // or signed with a rotated secret long before `exp` says so.
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, endSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, endSession);
  }, [endSession]);

  // Expire on schedule too, so a tab left open overnight lands on the login
  // screen by itself instead of waiting for the next request to fail.
  useEffect(() => {
    if (!session) return undefined;
    const timer = setTimeout(endSession, Math.min(session.claims.exp * 1000 - Date.now(), MAX_TIMEOUT_MS));
    return () => clearTimeout(timer);
  }, [session, endSession]);

  const value = useMemo(
    () => ({
      token: session?.token ?? null,
      role: session?.claims.role ?? null,
      sessionExpired,
      login,
      logout,
    }),
    [session, sessionExpired, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
