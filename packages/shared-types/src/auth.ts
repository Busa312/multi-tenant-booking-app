import type { TenantUserRole } from "./entities";

// Shape of the decoded JWT issued to CMS users (apps/api -> apps/cms).
export interface JwtClaims {
  sub: string; // TenantUser.id
  tenantId: string;
  role: TenantUserRole;
  professionalId?: string; // present only when role === "professional"
  iat: number;
  exp: number;
}
