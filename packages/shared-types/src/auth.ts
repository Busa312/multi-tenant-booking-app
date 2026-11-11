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
  iat: number;
  exp: number;
}
