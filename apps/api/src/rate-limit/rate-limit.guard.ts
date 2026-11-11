import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { FastifyReply, FastifyRequest } from "fastify";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { RATE_LIMIT_KEY, type RateLimitRule } from "./rate-limit.decorator.js";
import { RateLimitService } from "./rate-limit.service.js";
import { clientAddress } from "./client-address.js";

/**
 * Global guard: a no-op unless the handler carries @RateLimit. Counted per
 * client address (see clientAddress) and, where the request belongs to one,
 * per salon — so a visitor's budget at one salon doesn't spend another's, and
 * a fallback address shared by many visitors is at least split by salon.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly publicSiteKey: string | undefined;

  constructor(
    private readonly reflector: Reflector,
    private readonly limits: RateLimitService,
    private readonly tenantContext: TenantContextService,
    config: ConfigService,
  ) {
    this.publicSiteKey = config.get<string>("PUBLIC_SITE_API_KEY") || undefined;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules = this.reflector.getAllAndOverride<RateLimitRule[] | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rules || rules.length === 0) return true;

    const http = context.switchToHttp();
    const address = clientAddress(http.getRequest<FastifyRequest>(), this.publicSiteKey);
    const tenant = this.tenantContext.currentOrNull?.tenantId ?? "-";

    for (const rule of rules) {
      const result = await this.limits.hit(`${rule.name}:${tenant}:${address}`, rule.max, rule.windowSeconds);
      if (!result.allowed) {
        http.getResponse<FastifyReply>().header("Retry-After", String(result.retryAfterSeconds));
        throw tooManyRequests(result.retryAfterSeconds);
      }
    }
    return true;
  }
}

export function tooManyRequests(retryAfterSeconds: number): HttpException {
  return new HttpException(
    { code: "rate_limited", message: "Too many requests. Try again later.", retryAfterSeconds },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
