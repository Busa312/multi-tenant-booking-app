import type { TenantUserRole } from "./entities";

// Shape of the decoded JWT issued to CMS users (apps/api -> apps/cms).
export interface JwtClaims {
  sub: string; // TenantUser.id
  tenantId: string;
  role: TenantUserRole;
  professionalId?: string; // present only when role === "professional"
  // R320: this session's id (revoked on logout) and the user's session version
  // when it was issued (a bump ends every older session).
  jti: string;
  sv: number;
  // R320: when the person signed in (seconds). Renewals carry it over, so a
  // session ends 90 days after it, however active. Absent on older tokens.
  authTime?: number;
  iat: number;
  exp: number;
}
