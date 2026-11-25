import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Observable } from "rxjs";
import type { JwtClaims } from "@booking/shared-types";
import { sessionCookieConfig, setSessionCookie, type SessionCookieConfig } from "./session-cookie.js";
import { needsRenewal, renewedLifetimeSeconds, signedInAt } from "./session-lifetime.js";

/**
 * R320: keeps a CMS session alive while it's used. Runs after JwtAuthGuard has
 * accepted the token (it only acts when `request.user` holds CMS claims); a
 * token older than an hour is replaced by one with a fresh 7 days (never past
 * 90 days from signing in), carrying the
 * same claims and the same session id (`jti`), so logging out still revokes
 * it and a session-version bump still ends it. `request.user` is updated too,
 * so `/cms/auth/me` answers with the new expiry.
 */
@Injectable()
export class SessionRenewalInterceptor implements NestInterceptor {
  private readonly cookie: SessionCookieConfig;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.cookie = sessionCookieConfig((key) => config.get<string>(key));
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() === "http") {
      const http = context.switchToHttp();
      const request = http.getRequest<FastifyRequest & { user?: JwtClaims }>();
      const claims = request.user;
      const now = Date.now();
      const lifetime = isCmsClaims(claims) ? renewedLifetimeSeconds(claims, now) : 0;
      if (request.url.startsWith("/cms/") && isCmsClaims(claims) && needsRenewal(claims, now) && lifetime > 0) {
        const { iat: _iat, exp: _exp, jti, ...rest } = claims;
        // The sign-in time travels on, so the 90-day limit counts from signing in
        const token = await this.jwt.signAsync({ ...rest, authTime: signedInAt(claims) }, { jwtid: jti, expiresIn: lifetime });
        const { iat, exp } = this.jwt.decode<{ iat: number; exp: number }>(token);
        setSessionCookie(http.getResponse<FastifyReply>(), token, new Date(exp * 1000), this.cookie);
        request.user = { ...claims, iat, exp };
      }
    }
    return next.handle();
  }
}

function isCmsClaims(value: unknown): value is JwtClaims {
  if (!value || typeof value !== "object") return false;
  const claims = value as Partial<JwtClaims>;
  return (
    typeof claims.sub === "string" &&
    typeof claims.tenantId === "string" &&
    typeof claims.jti === "string" &&
    typeof claims.sv === "number" &&
    typeof claims.iat === "number"
  );
}
