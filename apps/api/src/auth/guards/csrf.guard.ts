import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

export const CSRF_HEADER = "x-requested-with";
export const CSRF_HEADER_VALUE = "booking-cms";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * R320: the CMS session rides in a cookie, so a request another site makes the
 * browser send would carry it. Every state-changing /cms request must therefore
 * carry X-Requested-With — a header no HTML form can set, and that a script on
 * another origin can only set after a CORS preflight, which only the CMS's
 * origin passes. A second line behind SameSite=Strict, and the only line if a
 * deployment has to relax SameSite.
 *
 * Global, but only /cms: the public API has no cookie to ride on.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (SAFE_METHODS.has(request.method)) return true;
    const path = request.url.split("?")[0] ?? "";
    if (!path.startsWith("/cms/")) return true;
    if (request.headers[CSRF_HEADER] !== CSRF_HEADER_VALUE) {
      throw new ForbiddenException({ code: "csrf", message: "Missing request header" });
    }
    return true;
  }
}
