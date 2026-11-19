import type { SubscriptionPlan } from "@booking/shared-types";
import type { PlanCatalog } from "./plan-catalog.service.js";
import { PlansController } from "./plans.controller.js";

// R560: what the marketing site prints is exactly what owners can choose.
describe("PlansController", () => {
  it("answers with the offered plans", async () => {
    const plans: SubscriptionPlan[] = [
      { id: "early", price: "60.00", maxLocations: 1, prioritySupport: false },
      { id: "pro", price: "150.00", maxLocations: null, prioritySupport: true },
    ];
    const catalog = { offered: jest.fn(() => Promise.resolve(plans)) } as unknown as PlanCatalog;

    expect(await new PlansController(catalog).offered()).toEqual({ plans });
  });
});
