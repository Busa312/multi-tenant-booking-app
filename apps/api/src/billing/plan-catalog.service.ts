import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { AdminPlan, AdminUpdatePlanRequest, SubscriptionPlan } from "@booking/shared-types";
import type { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { MarketingRebuild } from "./marketing-rebuild.service.js";
import { toAdminPlan, toPlanDefinition, toWirePlan, validatePlanUpdate, type PlanDefinition } from "./plans.js";

const ORDER = [{ position: "asc" as const }, { id: "asc" as const }];

/**
 * R470/R550: the plans, from the `subscription_plan` table. Platform-wide (no
 * tenant_id, no RLS), so billing reads them inside the tenant's own
 * transaction, and the admin outside any tenant. A handful of rows, read per
 * use rather than cached: an admin's edit is seen by every instance at once.
 */
@Injectable()
export class PlanCatalog {
  private readonly logger = new Logger(PlanCatalog.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketing: MarketingRebuild,
  ) {}

  /** Every plan, in page order, read in the caller's transaction. */
  async allIn(tx: Prisma.TransactionClient): Promise<PlanDefinition[]> {
    const rows = await tx.subscriptionPlan.findMany({ orderBy: ORDER });
    return rows.map(toPlanDefinition);
  }

  /** R550: for the admin page — outside any tenant; the table belongs to none. */
  async list(): Promise<AdminPlan[]> {
    return (await this.allIn(this.prisma.client)).map(toAdminPlan);
  }

  /** R560: the plans an owner can choose now, as the marketing site shows them — outside any tenant. */
  async offered(): Promise<SubscriptionPlan[]> {
    return (await this.allIn(this.prisma.client)).filter((plan) => plan.offered).map(toWirePlan);
  }

  /**
   * R550: one plan edited by the platform admin. At least one plan stays
   * offered, or no owner could pay. Logged with the old and new values.
   */
  async update(id: string, body: AdminUpdatePlanRequest): Promise<AdminPlan> {
    const data = validatePlanUpdate(body);
    const { before, after } = await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.subscriptionPlan.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException("No such plan");
      if (data.offered === false && existing.offered) {
        const othersOffered = await tx.subscriptionPlan.count({ where: { offered: true, id: { not: id } } });
        if (othersOffered === 0) throw new ConflictException("At least one plan must stay offered, or no salon could pay.");
      }
      const updated = await tx.subscriptionPlan.update({ where: { id }, data });
      return { before: toPlanDefinition(existing), after: toPlanDefinition(updated) };
    });
    this.logger.log(`plan ${id} changed by the platform admin: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    // R560: the marketing site prints the plans at build time — rebuild it.
    void this.marketing.rebuild(`plan ${id} changed`);
    return toAdminPlan(after);
  }
}
