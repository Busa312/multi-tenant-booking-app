import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/index.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { MarketingRebuild } from "./marketing-rebuild.service.js";
import { PlanCatalog } from "./plan-catalog.service.js";

function setup(rows: { id: string; offered: boolean }[]) {
  const plans = rows.map((row, position) => ({
    ...row,
    price: new Prisma.Decimal("60.00"),
    maxLocations: 1,
    prioritySupport: false,
    position,
    updatedAt: new Date(),
  }));
  const tx = {
    subscriptionPlan: {
      findMany: jest.fn(() => Promise.resolve(plans)),
      findUnique: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(plans.find((p) => p.id === where.id) ?? null)),
      count: jest.fn(({ where }: { where: { id: { not: string } } }) => Promise.resolve(plans.filter((p) => p.offered && p.id !== where.id.not).length)),
      update: jest.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = plans.find((p) => p.id === where.id);
        if (!row) throw new Error("missing");
        Object.assign(row, data, typeof data.price === "string" ? { price: new Prisma.Decimal(data.price) } : {});
        return Promise.resolve(row);
      }),
    },
  };
  const prisma = { client: { ...tx, $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) } } as unknown as PrismaService;
  const marketing = { rebuild: jest.fn(() => Promise.resolve()) };
  return { catalog: new PlanCatalog(prisma, marketing as unknown as MarketingRebuild), plans, marketing };
}

// R550
describe("PlanCatalog.update", () => {
  it("changes the fields sent and answers with the plan as it now is", async () => {
    const { catalog } = setup([{ id: "early", offered: true }]);

    expect(await catalog.update("early", { price: "70", maxLocations: 2 })).toMatchObject({ id: "early", price: "70.00", maxLocations: 2 });
  });

  it("keeps at least one plan offered, or no salon could pay", async () => {
    const { catalog } = setup([{ id: "early", offered: true }, { id: "standard", offered: false }]);

    await expect(catalog.update("early", { offered: false })).rejects.toThrow(ConflictException);
    await catalog.update("standard", { offered: true });
    await expect(catalog.update("early", { offered: false })).resolves.toMatchObject({ offered: false });
  });

  // R560: the marketing site prints the plans, so it is rebuilt after a change.
  it("asks for the marketing site to be rebuilt once the change is saved", async () => {
    const { catalog, marketing } = setup([{ id: "early", offered: true }]);

    await catalog.update("early", { price: "70" });
    expect(marketing.rebuild).toHaveBeenCalledTimes(1);
  });

  it("can't invent a plan", async () => {
    const { catalog, marketing } = setup([{ id: "early", offered: true }]);

    await expect(catalog.update("gold", { price: "10" })).rejects.toThrow(NotFoundException);
    expect(marketing.rebuild).not.toHaveBeenCalled();
  });
});

// R560
describe("PlanCatalog.offered", () => {
  it("lists only the plans an owner can choose now, in page order, without the internal flag", async () => {
    const { catalog } = setup([
      { id: "early", offered: true },
      { id: "standard", offered: false },
      { id: "pro", offered: true },
    ]);

    const plans = await catalog.offered();
    expect(plans.map((plan) => plan.id)).toEqual(["early", "pro"]);
    expect(plans[0]).not.toHaveProperty("offered");
    expect(plans[0]).toMatchObject({ price: "60.00", maxLocations: 1, prioritySupport: false });
  });
});
