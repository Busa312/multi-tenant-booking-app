import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { FastifyRequest } from "fastify";
import type { JwtClaims } from "@booking/shared-types";
import { TenantContextService } from "../../tenant/tenant-context.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RedisService } from "../../redis/redis.service.js";
import { revokedSessionKey } from "../auth.service.js";
import { pastAbsoluteLimit } from "../session-lifetime.js";

/**
 * CMS routes' equivalent of HostTenantMiddleware: tenant identity here comes
 * from the JWT (`tenant_id`, `role`, `professional_id` claims), not the Host
 * header (system_design.md §4/§6). Runs passport-jwt validation first, then
 * seeds TenantContextService from the resulting claims so PrismaService.forTenant
 * and RolesGuard downstream both see it.
 *
 * R320: a valid signature isn't enough. The session must be under 90 days
 * old (from signing in), must not have been logged out (its `jti` in Redis),
 * and the user must still be active with the session version the token was
 * issued under — a password change, reset or deactivation ends every older
 * token at once.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) {
      return false;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest & { user: JwtClaims }>();
    const claims = request.user;
    // Tokens from before R320 carry neither; they're simply signed in again.
    if (!claims.jti || typeof claims.sv !== "number") {
      throw new UnauthorizedException("Session expired");
    }

    // R320: 90 days after signing in, however active — sign in again
    if (pastAbsoluteLimit(claims, Date.now())) {
      throw new UnauthorizedException("Session expired");
    }

    if (await this.isRevoked(claims.jti)) {
      throw new UnauthorizedException("Session ended");
    }

    this.tenantContext.update({
      tenantId: claims.tenantId,
      role: claims.role,
      professionalId: claims.professionalId,
    });

    const user = await this.prisma.forTenant((tx) =>
      tx.tenantUser.findFirst({
        where: { id: claims.sub, tenantId: claims.tenantId },
        select: { isActive: true, sessionVersion: true },
      }),
    );
    if (!user || !user.isActive || user.sessionVersion !== claims.sv) {
      throw new UnauthorizedException("Session ended");
    }

    return true;
  }

  /**
   * Fails open like every other Redis use: while Redis is down a logged-out
   * token stays usable until it expires. Logout itself falls back to bumping
   * the session version when it can't write here (AuthService.logout), so the
   * gap is only for sessions ended *before* an outage.
   */
  private async isRevoked(jti: string): Promise<boolean> {
    try {
      return (await this.redis.client.exists(revokedSessionKey(jti))) === 1;
    } catch {
      return false;
    }
  }
}
