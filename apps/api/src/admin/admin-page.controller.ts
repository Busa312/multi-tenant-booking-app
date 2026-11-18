import { randomBytes } from "node:crypto";
import { Controller, Get, Header, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { OwnerSetupLinkService } from "../internal/owner-setup-link.service.js";
import { RateLimit } from "../rate-limit/rate-limit.decorator.js";
import { AdminAuthService } from "./admin-auth.service.js";
import { adminPageCsp, renderAdminPage, type AdminPageConfig } from "./admin-page.js";

/** R430: serves the admin page. 404 when no admin is configured. */
@ApiExcludeController()
@Controller("admin")
export class AdminPageController {
  private readonly pageConfig: AdminPageConfig;

  constructor(
    private readonly auth: AdminAuthService,
    setupLinks: OwnerSetupLinkService,
    config: ConfigService,
  ) {
    const production = config.get<string>("NODE_ENV") === "production";
    this.pageConfig = {
      // Where owners sign in: CMS_URL, else the CMS origin CORS already allows.
      cmsUrl: config.get<string>("CMS_URL") ?? config.get<string>("CORS_ORIGINS")?.split(",")[0]?.trim() ?? null,
      siteBaseDomain: config.get<string>("PUBLIC_SITE_BASE_DOMAIN") ?? null,
      siteProtocol: production ? "https" : "http",
      // R430: whether set-password links can be emailed, or come back to pass on by hand
      mailConfigured: setupLinks.canEmail,
    };
  }

  @Get()
  @Header("Cache-Control", "no-store")
  @Header("Referrer-Policy", "no-referrer")
  @RateLimit({ name: "admin-read", max: 120, windowSeconds: 60 })
  page(@Res({ passthrough: true }) reply: FastifyReply): string {
    this.auth.assertEnabled();
    const nonce = randomBytes(16).toString("base64");
    reply.header("Content-Type", "text/html; charset=utf-8");
    reply.header("Content-Security-Policy", adminPageCsp(nonce));
    return renderAdminPage(nonce, this.pageConfig);
  }
}
