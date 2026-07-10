import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { FastifyRequest } from "fastify";
import type { JwtClaims } from "@booking/shared-types";
import { TenantContextService } from "../../tenant/tenant-context.service.js";

/**
 * CMS routes' equivalent of HostTenantMiddleware: tenant identity here comes
 * from the JWT (`tenant_id`, `role`, `professional_id` claims), not the Host
 * header (system_design.md §4/§6). Runs passport-jwt validation first, then
 * seeds TenantContextService from the resulting claims so PrismaService.forTenant
 * and RolesGuard downstream both see it.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly tenantContext: TenantContextService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) {
      return false;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest & { user: JwtClaims }>();
    this.tenantContext.update({
      tenantId: request.user.tenantId,
      role: request.user.role,
      professionalId: request.user.professionalId,
    });

    return true;
  }
}
