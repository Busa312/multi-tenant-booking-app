import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CmsSession, TenantUserRole } from "@booking/shared-types";
import { SESSION_EXPIRED_EVENT, cmsApiClient } from "../lib/api.js";
import { clearCmsCache } from "../lib/cache.js";
import { switchOffPush } from "../lib/pushNotifications.js";

// Where the token used to live before R320. Cleared on start-up so a token
// left behind by an older build doesn't linger in storage.
const LEGACY_TOKEN_KEY = "booking_cms_token";

// setTimeout treats delays past ~24.8 days as 0 and fires immediately, so a
// far-future expiry (or a clock skewed backwards) is capped rather than trusted.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

interface AuthContextValue {
  /** "loading" until the API has said whether there's a session — nothing should redirect before then. */
  status: "loading" | "ready";
  session: CmsSession | null;
  role: TenantUserRole | null;
  /** Present only for `professional` logins — the calendar they're confined to (R20). */
  professionalId: string | null;
  /** True when the session ended on its own rather than by signing out — lets
   *  the login screen explain why the user is suddenly back there. */
  sessionExpired: boolean;
  /** Called with what login / set-password / reset-password answered. */
  login: (session: CmsSession) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * R320: the session token lives in an httpOnly cookie this code can't read —
 * which is the point: a script injected into the page has nothing to steal.
 * So the CMS asks the API who's signed in (`/cms/auth/me`) instead of decoding
 * a token. Role and professional id here only shape the UI; the API enforces
 * them (RolesGuard) on every request regardless.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [session, setSession] = useState<CmsSession | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
      // Storage unavailable — nothing to clean up.
    }
    let cancelled = false;
    cmsApiClient
      .me()
      .then((current) => {
        if (!cancelled) setSession(current);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Every session boundary clears the CMS read cache. It is keyed by resource
  // rather than by tenant or user, so a second sign-in in the same tab would
  // otherwise render the previous session's rows — and since a `professional`
  // sees a narrower slice of those same endpoints than an `owner` (R20), that
  // is a correctness concern, not just a stale-data one.
  const endSession = useCallback(() => {
    clearCmsCache();
    setSession(null);
    setSessionExpired(true);
  }, []);

  const login = useCallback((next: CmsSession) => {
    clearCmsCache();
    setSessionExpired(false);
    setSession(next);
  }, []);

  const logout = useCallback(async () => {
    // R620: signing out switches this device's notifications off — while the
    // session still works, so the API can forget it. Never throws.
    await switchOffPush();
    // R320: the API revokes the session and drops the cookie. Awaited: if the
    // cookie outlived a "signed out" screen, a reload would quietly sign back in.
    await cmsApiClient.logout().catch(() => undefined);
    clearCmsCache();
    setSession(null);
    // Signing out deliberately isn't an expiry — no "session expired" notice.
    setSessionExpired(false);
  }, []);

  // The API is the authority on whether a session still works: it may be
  // revoked long before it expires.
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, endSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, endSession);
  }, [endSession]);

  // Check again when the session would expire, so a tab left open for a week
  // lands on the login screen by itself. R320: the API renews a session in use
  // (7 days from the last request), so the expiry known here may be stale —
  // ask before ending it; a renewed session just carries on.
  useEffect(() => {
    if (!session) return undefined;
    const timer = setTimeout(() => {
      cmsApiClient.me().then(setSession, endSession);
    }, Math.min(Date.parse(session.expiresAt) - Date.now(), MAX_TIMEOUT_MS));
    return () => clearTimeout(timer);
  }, [session, endSession]);

  const value = useMemo(
    () => ({
      status,
      session,
      role: session?.role ?? null,
      professionalId: session?.professionalId ?? null,
      sessionExpired,
      login,
      logout,
    }),
    [status, session, sessionExpired, login, logout],
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
