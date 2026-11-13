import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { AdminSession } from "@booking/shared-types";
import { AdminAuthService } from "./admin-auth.service.js";
import { ADMIN_COOKIE } from "./admin-cookie.js";

export type AdminRequest = FastifyRequest & { adminSession?: AdminSession };

/** R430: only a signed-in platform admin gets through; the session is put on the request. */
@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    this.auth.assertEnabled();
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const session = await this.auth.verify(request.cookies?.[ADMIN_COOKIE]);
    if (!session) throw new UnauthorizedException("Sign in as the platform admin");
    request.adminSession = session;
    return true;
  }
}
