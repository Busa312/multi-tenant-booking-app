import { BadRequestException } from "@nestjs/common";
import { locationLimit, planFits, type PlanDefinition, validatePlanUpdate } from "./plans.js";

const PLANS: PlanDefinition[] = [
  { id: "early", price: "60.00", maxLocations: 1, prioritySupport: false, offered: true },
  { id: "early_pro", price: "90.00", maxLocations: 3, prioritySupport: false, offered: true },
  { id: "pro", price: "150.00", maxLocations: null, prioritySupport: true, offered: true },
];

function plan(id: string): PlanDefinition {
  const found = PLANS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no plan ${id}`);
  return found;
}

const paying = { status: "active" as const, planId: "early", nextPlanId: null, cancelAtPeriodEnd: false, billingAvailable: true };

// R540
describe("locationLimit", () => {
  it("is the plan's limit for a salon that pays, or is in grace or lapsed", () => {
    expect(locationLimit(paying, PLANS)).toBe(1);
    expect(locationLimit({ ...paying, status: "past_due", planId: "early_pro" }, PLANS)).toBe(3);
    expect(locationLimit({ ...paying, status: "lapsed" }, PLANS)).toBe(1);
    expect(locationLimit({ ...paying, planId: "pro" }, PLANS)).toBeNull();
  });

  it("doesn't apply on the trial, on free use, or with no payment provider", () => {
    expect(locationLimit({ ...paying, status: "trial" }, PLANS)).toBeNull();
    expect(locationLimit({ ...paying, status: "free" }, PLANS)).toBeNull();
    expect(locationLimit({ ...paying, billingAvailable: false }, PLANS)).toBeNull();
  });

  it("follows the plan the salon renews on — unless it cancelled", () => {
    expect(locationLimit({ ...paying, nextPlanId: "pro" }, PLANS)).toBeNull();
    expect(locationLimit({ ...paying, planId: "pro", nextPlanId: "early_pro" }, PLANS)).toBe(3);
    expect(locationLimit({ ...paying, nextPlanId: "pro", cancelAtPeriodEnd: true }, PLANS)).toBe(1);
  });

  // R550: the limit is whatever the admin last set
  it("reads the limit from the plans it's given", () => {
    const raised = PLANS.map((p) => (p.id === "early" ? { ...p, maxLocations: 2 } : p));
    expect(locationLimit(paying, raised)).toBe(2);
  });
});

describe("planFits", () => {
  it("counts active locations against the plan's limit", () => {
    expect(planFits(plan("early_pro"), 3)).toBe(true);
    expect(planFits(plan("early_pro"), 4)).toBe(false);
    expect(planFits(plan("pro"), 40)).toBe(true);
  });
});

// R550
describe("validatePlanUpdate", () => {
  it("takes only the fields sent", () => {
    expect(validatePlanUpdate({ price: "75.5" })).toEqual({ price: "75.5" });
    expect(validatePlanUpdate({ maxLocations: null, offered: false })).toEqual({ maxLocations: null, offered: false });
  });

  // R500: texts are unlimited, so there is no allowance to set
  it("has nothing to change when only a texts allowance is sent", () => {
    expect(() => validatePlanUpdate({ smsIncluded: 1800 } as never)).toThrow(BadRequestException);
  });

  it("refuses nonsense, naming the field", () => {
    for (const body of [
      { price: "0.50" },
      { price: "-5" },
      { price: "60.001" },
      { price: "abc" },
      { maxLocations: 0 },
      { offered: "yes" as unknown as boolean },
      {},
    ]) {
      expect(() => validatePlanUpdate(body)).toThrow(BadRequestException);
    }
  });
});
