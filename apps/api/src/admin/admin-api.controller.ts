import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import type {
  AdminLoginRequest,
  AdminSession,
  AdminTenantSummary,
  OnboardTenantRequest,
  OnboardTenantResponse,
} from "@booking/shared-types";
import { RateLimit } from "../rate-limit/rate-limit.decorator.js";
import { OnboardingService } from "../internal/onboarding.service.js";
import { AdminAuthService } from "./admin-auth.service.js";
import { ADMIN_COOKIE, adminCookieConfig, clearAdminCookie, setAdminCookie, type AdminCookieConfig } from "./admin-cookie.js";
import { AdminSessionGuard, type AdminRequest } from "./admin-session.guard.js";

// R330: per address. Generous for a person, tight for a script.
const LIMIT_READ = { max: 120, windowSeconds: 60 };

/**
 * R430: what the admin page calls. Same origin as the page, so no CORS; the
 * global CsrfGuard covers /admin writes too. Kept out of the public Swagger
 * map: it is staff tooling, not API surface.
 */
@ApiExcludeController()
@Controller("admin/api")
export class AdminApiController {
  private readonly cookie: AdminCookieConfig;

  constructor(
    private readonly auth: AdminAuthService,
    private readonly onboarding: OnboardingService,
    config: ConfigService,
  ) {
    this.cookie = adminCookieConfig((key) => config.get<string>(key));
  }

  @Post("login")
  @HttpCode(200)
  @RateLimit({ name: "admin-login", max: 10, windowSeconds: 15 * 60 })
  async login(@Body() body: AdminLoginRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<AdminSession> {
    const { token, session } = await this.auth.login(body);
    setAdminCookie(reply, token, new Date(session.expiresAt), this.cookie);
    return session;
  }

  @Post("logout")
  @HttpCode(204)
  @RateLimit({ name: "admin-read", ...LIMIT_READ })
  async logout(@Req() request: AdminRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<void> {
    await this.auth.logout(request.cookies?.[ADMIN_COOKIE]);
    clearAdminCookie(reply, this.cookie);
  }

  @Get("session")
  @UseGuards(AdminSessionGuard)
  @RateLimit({ name: "admin-read", ...LIMIT_READ })
  session(@Req() request: AdminRequest): AdminSession | undefined {
    return request.adminSession;
  }

  @Get("tenants")
  @UseGuards(AdminSessionGuard)
  @RateLimit({ name: "admin-read", ...LIMIT_READ })
  listTenants(): Promise<AdminTenantSummary[]> {
    return this.onboarding.listTenants();
  }

  @Post("tenants")
  @UseGuards(AdminSessionGuard)
  @RateLimit({ name: "admin-onboard", max: 60, windowSeconds: 60 * 60 })
  createTenant(@Body() body: OnboardTenantRequest): Promise<OnboardTenantResponse> {
    return this.onboarding.onboardTenant(body);
  }
}
