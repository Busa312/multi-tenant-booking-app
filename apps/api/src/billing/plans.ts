import type { AdminPlan, AdminUpdatePlanRequest, SubscriptionPlan, SubscriptionPlanId, SubscriptionStatus } from "@booking/shared-types";
import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/index.js";

/**
 * R470/R550: a plan as billing uses it. The plans themselves live in the
 * `subscription_plan` table, edited by the platform admin (PlanCatalog);
 * these are the pure rules over them. `offered` = an owner can choose it now;
 * a salon already on a plan that is no longer offered keeps renewing on it.
 */
export interface PlanDefinition extends SubscriptionPlan {
  offered: boolean;
}

type PlanRow = Prisma.SubscriptionPlanGetPayload<Record<string, never>>;

export function toPlanDefinition(row: PlanRow): PlanDefinition {
  return {
    id: row.id as SubscriptionPlanId,
    price: row.price.toFixed(2),
    smsIncluded: row.smsIncluded,
    maxLocations: row.maxLocations,
    prioritySupport: row.prioritySupport,
    offered: row.offered,
  };
}

/** What a new salon is put on until its owner chooses. */
export const DEFAULT_PLAN: SubscriptionPlanId = "early";

export function planIn(plans: readonly PlanDefinition[], id: unknown): PlanDefinition | undefined {
  return plans.find((plan) => plan.id === id);
}

/** The wire shape, without the internal `offered` flag. */
export function toWirePlan({ offered: _offered, ...plan }: PlanDefinition): SubscriptionPlan {
  return plan;
}

export function toAdminPlan(plan: PlanDefinition): AdminPlan {
  return { ...plan };
}

/** "60.00" GEL → 6000 tetri, the integer Flitt takes. */
export function toMinorUnits(amount: string): number {
  return Math.round(Number(amount) * 100);
}

export interface LocationLimitFacts {
  status: SubscriptionStatus;
  planId: string;
  nextPlanId: string | null;
  cancelAtPeriodEnd: boolean;
  /** Whether a payment provider is configured — without one nobody can upgrade. */
  billingAvailable: boolean;
}

/**
 * R540: how many active locations the salon may have now; null = no limit.
 * None on the free trial (no plan chosen yet), on free use, or where nobody
 * could pay to lift it. Otherwise the limit of the plan the salon renews on:
 * a switch waiting for the next renewal counts at once — an upgrade's room is
 * usable now (the bigger plan is charged at renewal), and a downgrade was only
 * accepted because the salon already fits it. A cancelled subscription renews
 * on nothing, so its current plan's limit holds.
 */
export function locationLimit(facts: LocationLimitFacts, plans: readonly PlanDefinition[]): number | null {
  if (!facts.billingAvailable || facts.status === "free" || facts.status === "trial") return null;
  const renewsOn = facts.cancelAtPeriodEnd ? facts.planId : (facts.nextPlanId ?? facts.planId);
  return planIn(plans, renewsOn)?.maxLocations ?? null;
}

/** R540: whether `active` locations fit a plan (for paying for it, or switching to it). */
export function planFits(plan: SubscriptionPlan, active: number): boolean {
  return plan.maxLocations === null || active <= plan.maxLocations;
}

const PRICE = /^\d{1,6}(\.\d{1,2})?$/;
const MAX_SMS = 1_000_000;
const MAX_LOCATIONS = 1000;

/**
 * R550: an admin's edit of one plan, checked field by field. Only what is sent
 * changes. Throws a 400 naming the field for anything out of range.
 */
export function validatePlanUpdate(body: AdminUpdatePlanRequest | null | undefined): Prisma.SubscriptionPlanUpdateInput {
  const data: Prisma.SubscriptionPlanUpdateInput = {};
  if (!body || typeof body !== "object") throw new BadRequestException("Nothing to change");

  if (body.price !== undefined) {
    const price = typeof body.price === "string" ? body.price.trim() : "";
    if (!PRICE.test(price) || Number(price) < 1) throw new BadRequestException("price must be at least 1.00 GEL, with up to two decimals");
    data.price = price;
  }
  if (body.smsIncluded !== undefined) {
    if (!Number.isInteger(body.smsIncluded) || body.smsIncluded < 0 || body.smsIncluded > MAX_SMS) {
      throw new BadRequestException(`smsIncluded must be a whole number, 0–${MAX_SMS}`);
    }
    data.smsIncluded = body.smsIncluded;
  }
  if (body.maxLocations !== undefined) {
    if (body.maxLocations !== null && (!Number.isInteger(body.maxLocations) || body.maxLocations < 1 || body.maxLocations > MAX_LOCATIONS)) {
      throw new BadRequestException(`maxLocations must be a whole number, 1–${MAX_LOCATIONS}, or null for no limit`);
    }
    data.maxLocations = body.maxLocations;
  }
  for (const field of ["prioritySupport", "offered"] as const) {
    const value = body[field];
    if (value === undefined) continue;
    if (typeof value !== "boolean") throw new BadRequestException(`${field} must be true or false`);
    data[field] = value;
  }
  if (Object.keys(data).length === 0) throw new BadRequestException("Nothing to change");
  return data;
}
