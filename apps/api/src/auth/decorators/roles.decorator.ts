import { SetMetadata } from "@nestjs/common";
import type { TenantUserRole } from "@booking/shared-types";

export const ROLES_KEY = "roles";

/** Restricts a CMS route to the given TenantUser roles. Must be paired with JwtAuthGuard + RolesGuard. */
export const Roles = (...roles: TenantUserRole[]) => SetMetadata(ROLES_KEY, roles);
