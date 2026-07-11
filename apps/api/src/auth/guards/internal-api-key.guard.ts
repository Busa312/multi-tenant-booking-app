import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyRequest } from "fastify";

/**
 * Guards staff-only endpoints (tenant onboarding) that run before any tenant
 * or TenantUser exists, so JwtAuthGuard/HostTenantMiddleware don't apply —
 * there's no JWT to issue and no Host header to resolve a tenant from yet.
 * A shared secret stands in for "staff running the internal onboarding tool"
 * (system_design.md §9); this is deliberately not wired into the CMS UI.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const provided = request.headers["x-internal-api-key"];
    const expected = this.config.getOrThrow<string>("INTERNAL_API_KEY");

    if (!provided || provided !== expected) {
      throw new UnauthorizedException("Invalid or missing internal API key");
    }

    return true;
  }
}
