import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { TenantUserRole } from "@booking/shared-types";
import { ROLES_KEY } from "../decorators/roles.decorator.js";
import { TenantContextService } from "../../tenant/tenant-context.service.js";

/**
 * Role enforcement lives here, in the API layer, not in Postgres: RLS scopes
 * rows to a tenant, it has no concept of owner-vs-professional within a
 * tenant (system_design.md §6). Must run after JwtAuthGuard, which is what
 * populates TenantContextService.role.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<TenantUserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { role } = this.tenantContext.current;
    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException(`Requires role: ${requiredRoles.join(" or ")}`);
    }

    return true;
  }
}
