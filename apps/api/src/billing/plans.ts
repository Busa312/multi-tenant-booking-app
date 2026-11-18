import type { SubscriptionPlan, SubscriptionPlanId } from "@booking/shared-types";

/**
 * R470: the plans, priced per ROADMAP.md §4. `offered` = an owner can choose it
 * now. Standard waits for SMS reminders; a salon already on a plan that is no
 * longer offered keeps renewing on it.
 */
interface PlanDefinition extends SubscriptionPlan {
  offered: boolean;
}

export const PLANS: readonly PlanDefinition[] = [
  { id: "early", price: "60.00", smsIncluded: 600, multipleLocations: false, prioritySupport: false, offered: true },
  { id: "standard", price: "90.00", smsIncluded: 600, multipleLocations: false, prioritySupport: false, offered: false },
  { id: "pro", price: "150.00", smsIncluded: 1500, multipleLocations: true, prioritySupport: true, offered: true },
];

/** What a new salon is put on until its owner chooses. */
export const DEFAULT_PLAN: SubscriptionPlanId = "early";

export function planById(id: unknown): PlanDefinition | undefined {
  return PLANS.find((plan) => plan.id === id);
}

/** The wire shape, without the internal `offered` flag. */
export function toWirePlan({ offered: _offered, ...plan }: PlanDefinition): SubscriptionPlan {
  return plan;
}

/** "60.00" GEL → 6000 tetri, the integer Flitt takes. */
export function toMinorUnits(amount: string): number {
  return Math.round(Number(amount) * 100);
}
