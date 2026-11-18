import { All, BadRequestException, Body, Controller, HttpCode, Logger, Post, Query, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { RateLimit } from "../rate-limit/rate-limit.decorator.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { BillingService, tenantOfOrder } from "./billing.service.js";
import { FlittClient, type FlittOrder } from "./flitt.client.js";

/**
 * Flitt's side of billing (system_design.md §12b). Neither route has a
 * session: the callback is trusted by its signature alone, and the return
 * route only redirects to the CMS, which then confirms the order itself.
 */
@ApiExcludeController()
@Controller("billing/flitt")
export class FlittController {
  private readonly logger = new Logger(FlittController.name);

  constructor(
    private readonly billing: BillingService,
    private readonly flitt: FlittClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Flitt's server-to-server result. Anything but 200 makes Flitt retry, for a day. */
  @Post("callback")
  @HttpCode(200)
  // R330: Flitt calls from two addresses; this is far above what it sends.
  @RateLimit({ name: "flitt-callback", max: 300, windowSeconds: 60 })
  async callback(@Body() body: unknown): Promise<string> {
    const raw = (body && typeof body === "object" && "response" in body ? (body as { response: unknown }).response : body) as FlittOrder | null;
    if (!raw || typeof raw !== "object" || !this.flitt.isAuthentic(raw)) {
      this.logger.warn("Flitt callback with a bad signature or merchant; ignored");
      throw new BadRequestException("Invalid signature");
    }
    const tenantId = tenantOfOrder(raw.order_id);
    if (!tenantId) {
      // Not one of ours (another integration on the same merchant): nothing to retry.
      return "OK";
    }
    await this.tenantContext.runWithTenant(tenantId, () => this.billing.applyOrder(raw));
    return "OK";
  }

  /**
   * Where Flitt sends the payer back (it may POST a form here). Redirects to
   * the CMS subscription page, which confirms the order with the API.
   */
  @All("return")
  @RateLimit({ name: "flitt-return", max: 60, windowSeconds: 60 })
  back(@Query("order") order: string | undefined, @Res() reply: FastifyReply): void {
    const page = `${this.flitt.config.cmsUrl}/settings/subscription`;
    const target = tenantOfOrder(order) ? `${page}?payment=${encodeURIComponent(order ?? "")}` : page;
    void reply.code(303).header("location", target).send();
  }
}
