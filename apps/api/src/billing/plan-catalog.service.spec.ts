import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/index.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { MarketingRebuild } from "./marketing-rebuild.service.js";
import { PlanCatalog } from "./plan-catalog.service.js";

function setup(rows: { id: string; offered: boolean }[], options: { inUse?: string[] } = {}) {
  const plans: Record<string, unknown>[] & { id: string; offered: boolean; position: number }[] = rows.map((row, position) => ({
    ...row,
    name: row.id,
    nameI18n: null,
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
      create: jest.fn(({ data }: { data: Record<string, unknown> & { id: string; offered: boolean; position: number } }) => {
        const row = { ...data, price: new Prisma.Decimal(data.price as string), nameI18n: data.nameI18n === Prisma.DbNull ? null : data.nameI18n, updatedAt: new Date() };
        plans.push(row);
        return Promise.resolve(row);
      }),
      // The foreign keys: a plan a subscription or payment points at can't go.
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        if (options.inUse?.includes(where.id)) {
          return Promise.reject(new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", { code: "P2003", clientVersion: "test" }));
        }
        plans.splice(plans.findIndex((p) => p.id === where.id), 1);
        return Promise.resolve();
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

// R550: plans added on the admin page
describe("PlanCatalog.create", () => {
  const body = { name: "Studio Plus", nameI18n: { ka: "სტუდია პლუსი" }, price: "45", maxLocations: 2, prioritySupport: false, offered: true };

  it("adds the plan after the others, with an id made from its name", async () => {
    const { catalog, plans } = setup([{ id: "early", offered: true }, { id: "pro", offered: true }]);

    expect(await catalog.create(body)).toMatchObject({ id: "studio_plus", name: "Studio Plus", nameI18n: { ka: "სტუდია პლუსი" }, price: "45.00", offered: true });
    expect(plans.find((plan) => plan.id === "studio_plus")?.position).toBe(2);
  });

  it("never takes an id that exists", async () => {
    const { catalog } = setup([{ id: "studio_plus", offered: true }]);

    expect((await catalog.create(body)).id).toBe("studio_plus_2");
  });

  it("rebuilds the marketing site only for a plan owners can choose", async () => {
    const { catalog, marketing } = setup([{ id: "early", offered: true }]);

    await catalog.create({ ...body, offered: false });
    expect(marketing.rebuild).not.toHaveBeenCalled();
    await catalog.create(body);
    expect(marketing.rebuild).toHaveBeenCalledTimes(1);
  });
});

// R550: only a plan no salon has ever used can be deleted
describe("PlanCatalog.remove", () => {
  it("deletes an unused plan", async () => {
    const { catalog, plans } = setup([{ id: "early", offered: true }, { id: "studio", offered: true }]);

    await catalog.remove("studio");
    expect(plans.map((plan) => plan.id)).toEqual(["early"]);
  });

  it("keeps a plan a salon is on or has paid for, and says to stop offering it instead", async () => {
    const { catalog, plans } = setup([{ id: "early", offered: true }, { id: "pro", offered: true }], { inUse: ["pro"] });

    await expect(catalog.remove("pro")).rejects.toThrow(/Stop offering it instead/);
    expect(plans).toHaveLength(2);
  });

  it("keeps the plan new salons start on", async () => {
    const { catalog } = setup([{ id: "early", offered: false }, { id: "pro", offered: true }]);

    await expect(catalog.remove("early")).rejects.toThrow(ConflictException);
  });

  it("keeps the last offered plan, or no salon could pay", async () => {
    const { catalog } = setup([{ id: "early", offered: false }, { id: "studio", offered: true }]);

    await expect(catalog.remove("studio")).rejects.toThrow(ConflictException);
  });

  it("answers 404 for a plan that doesn't exist", async () => {
    const { catalog } = setup([{ id: "early", offered: true }]);

    await expect(catalog.remove("gold")).rejects.toThrow(NotFoundException);
  });
});
