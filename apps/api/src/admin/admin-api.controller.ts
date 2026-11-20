import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import type {
  AdminContactRequest,
  AdminCreatePlanRequest,
  AdminLoginRequest,
  AdminPlan,
  AdminSession,
  AdminTenantSummary,
  AdminUpdateContactRequest,
  AdminUpdatePlanRequest,
  AdminUpdateSubscriptionRequest,
  OnboardTenantRequest,
  OnboardTenantResponse,
  OwnerSetupLink,
} from "@booking/shared-types";
import { RateLimit } from "../rate-limit/rate-limit.decorator.js";
import { OnboardingService } from "../internal/onboarding.service.js";
import { OwnerSetupLinkService } from "../internal/owner-setup-link.service.js";
import { BillingService } from "../billing/billing.service.js";
import { PlanCatalog } from "../billing/plan-catalog.service.js";
import { PLAN_ID } from "../billing/plans.js";
import { ContactService } from "../contact/contact.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
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
    private readonly billing: BillingService,
    private readonly plans: PlanCatalog,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly setupLinks: OwnerSetupLinkService,
    private readonly contact: ContactService,
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
  async listTenants(): Promise<AdminTenantSummary[]> {
    const tenants = await this.onboarding.listTenants();
    // R480: each salon's subscription is read in that salon's own context (RLS).
    const summaries: AdminTenantSummary[] = [];
    for (const tenant of tenants) {
      summaries.push({ ...tenant, subscription: await this.tenantContext.runWithTenant(tenant.id, () => this.billing.adminSummary()) });
    }
    return summaries;
  }

  // R430/R480: free use for a pilot salon, or a longer trial
  @Post("tenants/:id/subscription")
  @HttpCode(200)
  @UseGuards(AdminSessionGuard)
  @RateLimit({ name: "admin-write", max: 120, windowSeconds: 60 * 60 })
  async updateSubscription(
    @Param("id") id: string,
    @Body() body: AdminUpdateSubscriptionRequest,
  ): Promise<AdminTenantSummary["subscription"]> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new BadRequestException("Invalid salon id");
    // The tenant table has no RLS: this is the platform checking the salon exists.
    const tenant = await this.prisma.client.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!tenant) throw new NotFoundException("No such salon");
    return this.tenantContext.runWithTenant(id, () => this.billing.adminUpdate(body));
  }

  // R550: the plans, edited without a deploy
  @Get("plans")
  @UseGuards(AdminSessionGuard)
  @RateLimit({ name: "admin-read", ...LIMIT_READ })
  listPlans(): Promise<AdminPlan[]> {
    return this.plans.list();
  }

  @Post("plans/:id")
  @HttpCode(200)
  @UseGuards(AdminSessionGuard)
  @RateLimit({ name: "admin-write", max: 120, windowSeconds: 60 * 60 })
  updatePlan(@Param("id") id: string, @Body() body: AdminUpdatePlanRequest): Promise<AdminPlan> {
    if (!PLAN_ID.test(id)) throw new BadRequestException("Invalid plan id");
    return this.plans.update(id, body);
  }

  @Post("plans")
  @UseGuards(AdminSessionGuard)
  @RateLimit({ name: "admin-write", max: 120, windowSeconds: 60 * 60 })
  createPlan(@Body() body: AdminCreatePlanRequest): Promise<AdminPlan> {
    return this.plans.create(body);
  }

  // R550: only a plan no salon has ever used; the catalog says why otherwise.
  @Delete("plans/:id")
  @HttpCode(204)
  @UseGuards(AdminSessionGuard)
  @RateLimit({ name: "admin-write", max: 120, windowSeconds: 60 * 60 })
  async deletePlan(@Param("id") id: string): Promise<void> {
    if (!PLAN_ID.test(id)) throw new BadRequestException("Invalid plan id");
    await this.plans.remove(id);
  }

  // R580: requests from the marketing site's contact page
  @Get("contact-requests")
  @UseGuards(AdminSessionGuard)
  @RateLimit({ name: "admin-read", ...LIMIT_READ })
  listContactRequests(): Promise<AdminContactRequest[]> {
    return this.contact.list();
  }

  @Post("contact-requests/:id")
  @HttpCode(200)
  @UseGuards(AdminSessionGuard)
  @RateLimit({ name: "admin-write", max: 120, windowSeconds: 60 * 60 })
  updateContactRequest(@Param("id") id: string, @Body() body: AdminUpdateContactRequest): Promise<AdminContactRequest> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new BadRequestException("Invalid request id");
    if (typeof body?.handled !== "boolean") throw new BadRequestException("handled must be true or false");
    return this.contact.setHandled(id, body.handled);
  }

  @Post("tenants")
  @UseGuards(AdminSessionGuard)
  @RateLimit({ name: "admin-onboard", max: 60, windowSeconds: 60 * 60 })
  createTenant(@Body() body: OnboardTenantRequest): Promise<OnboardTenantResponse> {
    return this.onboarding.onboardTenant(body);
  }

  // R430: a fresh set-password link for a salon's owner — an expired or lost
  // one, or a forgotten password when the owner can't use "Forgot password".
  @Post("tenants/:id/owner-link")
  @HttpCode(200)
  @UseGuards(AdminSessionGuard)
  @RateLimit({ name: "admin-write", max: 120, windowSeconds: 60 * 60 })
  async sendOwnerLink(@Param("id") id: string): Promise<OwnerSetupLink> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new BadRequestException("Invalid salon id");
    // The tenant table has no RLS: this is the platform checking the salon exists.
    const tenant = await this.prisma.client.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!tenant) throw new NotFoundException("No such salon");
    return this.tenantContext.runWithTenant(id, () => this.setupLinks.sendFresh());
  }
}
