import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import type { JwtClaims, TenantUserRole } from "@booking/shared-types";

const STORAGE_KEY = "booking_cms_token";

interface AuthContextValue {
  token: string | null;
  role: TenantUserRole | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Decoding client-side (rather than a /cms/auth/me endpoint) is UI-only
// convenience — hiding owner-only nav/routes for professionals. The actual
// enforcement of R10 stays server-side via RolesGuard regardless of what this
// returns; a tampered/expired token just gets rejected by the API as normal.
function decodeRole(token: string): TenantUserRole | null {
  try {
    return jwtDecode<JwtClaims>(token).role;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [role, setRole] = useState<TenantUserRole | null>(() => (token ? decodeRole(token) : null));

  const login = useCallback((newToken: string) => {
    localStorage.setItem(STORAGE_KEY, newToken);
    setToken(newToken);
    setRole(decodeRole(newToken));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setRole(null);
  }, []);

  const value = useMemo(() => ({ token, role, login, logout }), [token, role, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
