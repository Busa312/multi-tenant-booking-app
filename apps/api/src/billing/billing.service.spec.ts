import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/index.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";
import { BillingService, orderIdFor, tenantOfOrder } from "./billing.service.js";
import type { FlittClient, FlittOrder } from "./flitt.client.js";
import type { RevalidationService } from "../cms/revalidation.service.js";
import type { MarketingRebuild } from "./marketing-rebuild.service.js";
import { PlanCatalog } from "./plan-catalog.service.js";

const TENANT = "11111111-1111-1111-1111-111111111111";
const DAY = 86_400_000;
const now = Date.now();
const days = (n: number) => new Date(now + n * DAY);

interface SubRow {
  tenantId: string;
  planId: string;
  nextPlanId: string | null;
  trialEndsAt: Date;
  paidThrough: Date | null;
  cancelAtPeriodEnd: boolean;
  free: boolean;
  rectoken: string | null;
  cardMasked: string | null;
  cardBrand: string | null;
  failedAttempts: number;
  retryAt: Date | null;
}

interface PlanRow {
  id: string;
  name: string;
  nameI18n: null;
  price: Prisma.Decimal;
  maxLocations: number | null;
  prioritySupport: boolean;
  offered: boolean;
  position: number;
}

/** The plans as the subscription_plan migration seeds them (R470/R540). */
const plan = (id: string, price: string, maxLocations: number | null, offered: boolean, position: number): PlanRow => ({
  id, name: id, nameI18n: null, price: new Prisma.Decimal(price), maxLocations, prioritySupport: id === "pro", offered, position,
});
const SEEDED_PLANS = [
  plan("early", "60.00", 1, true, 0),
  plan("early_pro", "90.00", 3, true, 1),
  plan("standard", "90.00", 1, false, 2),
  plan("pro", "150.00", null, true, 3),
];

interface PaymentRow {
  id: string;
  tenantId: string;
  orderId: string;
  kind: string;
  planId: string | null;
  amount: Prisma.Decimal;
  periodStart: Date | null;
  periodEnd: Date | null;
  status: string;
  createdAt: Date;
  [key: string]: unknown;
}

function setup(
  subOverrides: Partial<SubRow> = {},
  options: { configured?: boolean; smsParts?: number; payments?: Partial<PaymentRow>[]; activeLocations?: number; plans?: PlanRow[] } = {},
) {
  const sub: SubRow = {
    tenantId: TENANT,
    planId: "early",
    nextPlanId: null,
    trialEndsAt: days(5),
    paidThrough: null,
    cancelAtPeriodEnd: false,
    free: false,
    rectoken: null,
    cardMasked: null,
    cardBrand: null,
    failedAttempts: 0,
    retryAt: null,
    ...subOverrides,
  };
  // Earlier payments a test starts from (e.g. the one that bought the current month).
  const payments: PaymentRow[] = (options.payments ?? []).map((row, index) => ({
    id: `seed${index}`,
    tenantId: TENANT,
    orderId: `${TENANT}.signup.seed${index}`,
    kind: "signup",
    planId: "early",
    amount: new Prisma.Decimal("60.00"),
    periodStart: null,
    periodEnd: null,
    status: "approved",
    createdAt: new Date(now - 40 * DAY),
    extraTexts: 0,
    extraTextsAmount: new Prisma.Decimal(0),
    ...row,
  }));

  const tx = {
    tenant: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        createdAt: days(-9),
        subdomain: "demo",
        customDomain: null,
        domainVerifiedAt: null,
        timezone: "Asia/Tbilisi",
      }),
    },
    // R550: the plans, as the admin last left them
    subscriptionPlan: { findMany: jest.fn(() => Promise.resolve(options.plans ?? SEEDED_PLANS)) },
    // R540: the salon's active locations
    location: { count: jest.fn().mockResolvedValue(options.activeLocations ?? 0) },
    // R500: parts sent this month
    smsMessage: { aggregate: jest.fn().mockResolvedValue({ _sum: { parts: options.smsParts ?? null } }) },
    subscription: {
      findUnique: jest.fn(() => Promise.resolve({ ...sub })),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUniqueOrThrow: jest.fn(() => Promise.resolve({ ...sub })),
      update: jest.fn(({ data }: { data: Partial<SubRow> }) => Promise.resolve(Object.assign(sub, data))),
      updateMany: jest.fn(({ where, data }: { where: { OR?: { retryAt: null | { lte: Date } }[] }; data: Partial<SubRow> }) => {
        // The lease: only if nobody holds it at the time asked about.
        const asOf = where.OR?.map((clause) => clause.retryAt).find((value) => value !== null)?.lte;
        const free = sub.retryAt === null || (asOf !== undefined && sub.retryAt.getTime() <= asOf.getTime());
        if (where.OR && !free) return Promise.resolve({ count: 0 });
        Object.assign(sub, data);
        return Promise.resolve({ count: 1 });
      }),
    },
    subscriptionPayment: {
      create: jest.fn(({ data }: { data: Pick<PaymentRow, "tenantId" | "orderId" | "kind"> & Partial<PaymentRow> & { amount: string } }) => {
        const row: PaymentRow = {
          id: `p${payments.length + 1}`,
          status: "pending",
          createdAt: new Date(),
          periodStart: null,
          periodEnd: null,
          planId: null,
          extraTexts: 0,
          ...data,
          amount: new Prisma.Decimal(data.amount),
          // The column's default, as the database would fill it.
          extraTextsAmount: new Prisma.Decimal((data.extraTextsAmount as string | undefined) ?? 0),
        };
        payments.push(row);
        return Promise.resolve(row);
      }),
      findUnique: jest.fn(({ where }: { where: { orderId: string } }) => Promise.resolve(payments.find((p) => p.orderId === where.orderId) ?? null)),
      // The payment that bought the month ending at `periodEnd`.
      findFirst: jest.fn(({ where }: { where: { status: string; periodEnd: Date } }) =>
        Promise.resolve(
          payments.find((p) => p.status === where.status && p.periodEnd?.getTime() === where.periodEnd.getTime()) ?? null,
        ),
      ),
      findMany: jest.fn(() => Promise.resolve([...payments].reverse())),
      updateMany: jest.fn(({ where, data }: { where: { id: string; status: string }; data: Partial<PaymentRow> }) => {
        const row = payments.find((p) => p.id === where.id && p.status === where.status);
        if (!row) return Promise.resolve({ count: 0 });
        Object.assign(row, data);
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  const prisma = { forTenant: (fn: (client: typeof tx) => unknown) => fn(tx) } as unknown as PrismaService;
  const tenantContext = { current: { tenantId: TENANT } } as unknown as TenantContextService;
  const flitt = {
    configured: options.configured ?? true,
    config: { cycle: { kind: "month" }, graceMs: 7 * DAY, retryMs: DAY, apiPublicUrl: null, cmsUrl: "https://cms.example.com" },
    checkoutUrl: jest.fn().mockResolvedValue("https://pay.flitt.com/merchants/x/default/index.html?token=t"),
    recurring: jest.fn(),
    status: jest.fn(),
  };
  const revalidation = { revalidateTenant: jest.fn().mockResolvedValue(undefined) };
  const service = new BillingService(prisma, tenantContext, flitt as unknown as FlittClient, revalidation as unknown as RevalidationService, new PlanCatalog(prisma, { rebuild: jest.fn() } as unknown as MarketingRebuild));
  return { service, sub, payments, tx, flitt, revalidation };
}

const approved = (payment: PaymentRow, extra: Partial<FlittOrder> = {}): FlittOrder => ({
  order_id: payment.orderId,
  order_status: "approved",
  amount: String(Math.round(Number(payment.amount) * 100)),
  currency: "GEL",
  rectoken: "tok-1",
  masked_card: "444455XXXXXX1111",
  card_type: "VISA",
  ...extra,
});

describe("order ids", () => {
  it("name their tenant, and nothing else passes for one of ours", () => {
    expect(tenantOfOrder(orderIdFor(TENANT, "signup", "abc-123"))).toBe(TENANT);
    expect(tenantOfOrder("TestOrder2")).toBeNull();
    expect(tenantOfOrder(`${TENANT}.refund.x`)).toBeNull();
    expect(tenantOfOrder(undefined)).toBeNull();
  });
});

// R470
describe("BillingService.startCheckout", () => {
  it("opens Flitt's page for a month that starts when the trial ends", async () => {
    const { service, payments, flitt } = setup();

    const result = await service.startCheckout("pro", "https://api.example.com", "ka");

    expect(result.checkoutUrl).toMatch(/^https:\/\/pay\.flitt\.com\//);
    expect(payments[0]).toMatchObject({ kind: "signup", planId: "pro", periodStart: days(5), orderId: result.orderId });
    expect(Number(payments[0]?.amount)).toBe(150);
    expect(flitt.checkoutUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: result.orderId,
        amount: 15000,
        lang: "ka",
        verification: false,
        callbackUrl: "https://api.example.com/billing/flitt/callback",
        responseUrl: `https://api.example.com/billing/flitt/return?order=${encodeURIComponent(result.orderId)}`,
      }),
    );
  });

  it("refuses a salon that is already paid up — it switches plan instead", async () => {
    const { service } = setup({ paidThrough: days(20) });

    await expect(service.startCheckout("pro", "https://api.example.com", "ka")).rejects.toThrow(ConflictException);
  });

  it("refuses a plan that isn't offered", async () => {
    const { service } = setup();

    await expect(service.startCheckout("standard", "https://api.example.com", "ka")).rejects.toThrow(BadRequestException);
    await expect(service.startCheckout("gold", "https://api.example.com", "ka")).rejects.toThrow(BadRequestException);
  });

  // R490
  it("pauses nobody on a server with no payment provider — nobody there could pay", async () => {
    const lapsed = { trialEndsAt: days(-30) };
    const unconfigured = setup(lapsed, { configured: false });
    const configured = setup(lapsed);

    expect(await unconfigured.service.overview()).toMatchObject({ status: "lapsed", bookingPaused: false });
    expect(await configured.service.overview()).toMatchObject({ status: "lapsed", bookingPaused: true });
  });

  it("answers 503 on a server with no payment provider", async () => {
    const { service } = setup({}, { configured: false });

    await expect(service.startCheckout("early", "https://api.example.com", "ka")).rejects.toThrow(ServiceUnavailableException);
  });
});

describe("BillingService.applyOrder", () => {
  it("activates the subscription when Flitt approves the checkout", async () => {
    const { service, sub } = setup();
    const { orderId } = await service.startCheckout("pro", "https://api.example.com", "en");
    const { payments } = { payments: [{ orderId, amount: new Prisma.Decimal("150.00") }] as PaymentRow[] };

    await service.applyOrder(approved(payments[0] as PaymentRow));

    expect(sub).toMatchObject({ planId: "pro", rectoken: "tok-1", paidThrough: expect.any(Date) });
    expect((await service.overview()).status).toBe("active");
  });

  // R490
  it("refreshes the booking site's cache when a month is paid, so a paused site opens at once", async () => {
    const { service, payments, revalidation } = setup();
    await service.startCheckout("pro", "https://api.example.com", "en");

    await service.applyOrder(approved(payments[0] as PaymentRow));

    expect(revalidation.revalidateTenant).toHaveBeenCalledWith(expect.objectContaining({ subdomain: "demo" }));
  });

  it("counts a result once, however many times it arrives", async () => {
    const { service, sub, payments, tx } = setup();
    await service.startCheckout("pro", "https://api.example.com", "en");
    const order = approved(payments[0] as PaymentRow);

    await service.applyOrder(order);
    const paidThrough = sub.paidThrough;
    await service.applyOrder(order);

    expect(sub.paidThrough).toEqual(paidThrough);
    expect(tx.subscription.update).toHaveBeenCalledTimes(1);
  });

  it("ignores a result whose amount isn't what was asked", async () => {
    const { service, sub, payments } = setup();
    await service.startCheckout("pro", "https://api.example.com", "en");

    await service.applyOrder(approved(payments[0] as PaymentRow, { amount: "100" }));

    expect(sub.paidThrough).toBeNull();
    expect(payments[0]?.status).toBe("pending");
  });

  it("ignores an order belonging to another tenant", async () => {
    const { service, tx } = setup();

    await service.applyOrder({ order_id: orderIdFor("22222222-2222-2222-2222-222222222222", "signup", "x"), order_status: "approved" });

    expect(tx.subscriptionPayment.findUnique).not.toHaveBeenCalled();
  });
});

describe("BillingService.renewIfDue", () => {
  const paying = { trialEndsAt: days(-60), paidThrough: days(-0.5), rectoken: "tok-1", planId: "early" };

  it("charges the saved card for the next month, under an order id made of the month and the attempt", async () => {
    const { service, payments, flitt, sub } = setup(paying);
    flitt.recurring.mockImplementation(({ orderId }: { orderId: string }) =>
      Promise.resolve({ order_id: orderId, order_status: "approved", amount: "6000", currency: "GEL" }),
    );

    await expect(service.renewIfDue(new Date(now))).resolves.toBe("settled");

    expect(payments[0]).toMatchObject({ kind: "renewal", orderId: orderIdFor(TENANT, "renewal", `${days(-0.5).getTime()}-1`), status: "approved" });
    expect(flitt.recurring).toHaveBeenCalledWith(expect.objectContaining({ amount: 6000, rectoken: "tok-1" }));
    expect(sub.paidThrough?.getTime()).toBeGreaterThan(now);
  });

  it("asks again while Flitt is still processing the charge, and applies the outcome", async () => {
    const { service, flitt, sub } = setup(paying);
    service.processingCheckMs = 1;
    flitt.recurring.mockImplementation(({ orderId }: { orderId: string }) =>
      Promise.resolve({ order_id: orderId, order_status: "processing", amount: "6000", currency: "GEL" }),
    );
    flitt.status.mockImplementation((orderId: string) =>
      Promise.resolve({ order_id: orderId, order_status: "approved", amount: "6000", currency: "GEL" }),
    );

    await expect(service.renewIfDue(new Date(now))).resolves.toBe("settled");

    expect(flitt.status).toHaveBeenCalledTimes(1);
    expect(sub.paidThrough?.getTime()).toBeGreaterThan(now);
  });

  // R500: texts are unlimited on every plan
  it("charges only the plan's price, however many texts were sent", async () => {
    const ended = { periodStart: days(-30.5), periodEnd: days(-0.5) };
    const { service, flitt, payments, tx } = setup(paying, { smsParts: 5000, payments: [ended] });
    flitt.recurring.mockImplementation(({ orderId }: { orderId: string }) =>
      Promise.resolve({ order_id: orderId, order_status: "approved", amount: "6000", currency: "GEL" }),
    );

    await expect(service.renewIfDue(new Date(now))).resolves.toBe("settled");

    expect(flitt.recurring).toHaveBeenCalledWith(expect.objectContaining({ amount: 6000, description: "Subscription: early plan" }));
    const renewal = payments.find((p) => p.kind === "renewal");
    expect(Number(renewal?.amount)).toBe(60);
    expect(renewal).toMatchObject({ extraTexts: 0 });
    expect(tx.smsMessage.aggregate).not.toHaveBeenCalled();
  });

  it("renews on the plan the owner switched to", async () => {
    const { service, flitt, sub } = setup({ ...paying, nextPlanId: "pro" });
    flitt.recurring.mockImplementation(({ orderId }: { orderId: string }) =>
      Promise.resolve({ order_id: orderId, order_status: "approved", amount: "15000", currency: "GEL" }),
    );

    await service.renewIfDue(new Date(now));

    expect(flitt.recurring).toHaveBeenCalledWith(expect.objectContaining({ amount: 15000 }));
    expect(sub).toMatchObject({ planId: "pro", nextPlanId: null });
  });

  it("does nothing before the month ends, or while another instance holds the renewal", async () => {
    const early = setup({ ...paying, paidThrough: days(3) });
    await expect(early.service.renewIfDue(new Date(now))).resolves.toBe("none");

    const leased = setup({ ...paying, retryAt: days(0.004) });
    await expect(leased.service.renewIfDue(new Date(now))).resolves.toBe("none");
    expect(leased.flitt.recurring).not.toHaveBeenCalled();
  });

  it("looks up a renewal it never heard back about instead of charging again", async () => {
    const { service, flitt, payments } = setup(paying);
    flitt.recurring.mockRejectedValueOnce(new Error("network down"));
    await expect(service.renewIfDue(new Date(now))).resolves.toBe("unknown");

    // The lease ran out; the next pass finds the same month's pending payment.
    payments[0]!.createdAt = new Date(now - 5 * 60_000);
    flitt.status.mockResolvedValue({ order_id: payments[0]?.orderId, order_status: "approved", amount: "6000", currency: "GEL" });
    await expect(service.renewIfDue(new Date(now + 11 * 60_000))).resolves.toBe("settled");

    expect(flitt.recurring).toHaveBeenCalledTimes(1);
    expect(payments).toHaveLength(1);
    expect(payments[0]?.status).toBe("approved");
  });
});

describe("BillingService.update / confirm", () => {
  it("queues a plan switch for the next renewal, and can cancel and resume", async () => {
    const { service, sub } = setup({ paidThrough: days(20) });

    await service.update({ planId: "pro" });
    expect(sub.nextPlanId).toBe("pro");
    await service.update({ planId: "early" });
    expect(sub.nextPlanId).toBeNull();
    await service.update({ cancelAtPeriodEnd: true });
    expect(sub.cancelAtPeriodEnd).toBe(true);
  });

  it("doesn't change a subscription that isn't paid up", async () => {
    const { service } = setup();

    await expect(service.update({ planId: "pro" })).rejects.toThrow(ConflictException);
  });

  it("only confirms this tenant's own payments", async () => {
    const { service } = setup();

    await expect(service.confirm(orderIdFor("22222222-2222-2222-2222-222222222222", "signup", "x"))).rejects.toThrow(NotFoundException);
  });
});

// R500
describe("BillingService — texts", () => {
  it("shows the owner no text count: there is no limit to count against", async () => {
    const { service, tx } = setup({ planId: "early" }, { smsParts: 5000 });

    const overview = await service.overview();

    expect(overview).not.toHaveProperty("sms");
    expect(tx.smsMessage.aggregate).not.toHaveBeenCalled();
  });

  it("tells the platform admin this calendar month's texts, its own cost", async () => {
    const { service, tx } = setup({}, { smsParts: 214 });

    expect(await service.adminSummary()).toMatchObject({ smsThisMonth: 214 });
    const where = tx.smsMessage.aggregate.mock.calls[0]?.[0]?.where as { tenantId: string; sentAt: { gte: Date; lt: Date } };
    expect(where.tenantId).toBe(TENANT);
    expect(where.sentAt.lt.getTime() - where.sentAt.gte.getTime()).toBeGreaterThanOrEqual(28 * 86_400_000);
  });
});

// R430/R480
// R540
describe("BillingService — the plan's location limit", () => {
  const paying = { paidThrough: days(20) };
  const isLimit = (limit: number) => expect.objectContaining({ response: expect.objectContaining({ code: "plan_location_limit", limit }) });

  it("refuses a location beyond the plan's limit, and allows one within it", async () => {
    const full = setup(paying, { activeLocations: 1 });
    await expect(full.service.assertLocationAllowedIn(full.tx as never, TENANT)).rejects.toEqual(isLimit(1));

    const room = setup({ ...paying, planId: "early_pro" }, { activeLocations: 2 });
    await expect(room.service.assertLocationAllowedIn(room.tx as never, TENANT)).resolves.toBeUndefined();
  });

  it("has no limit on Pro, on the free trial, on free use, or with no payment provider", async () => {
    for (const { sub, options } of [
      { sub: { ...paying, planId: "pro" }, options: {} },
      { sub: {}, options: {} },
      { sub: { ...paying, free: true }, options: {} },
      { sub: paying, options: { configured: false } },
    ]) {
      const { service, tx } = setup(sub, { ...options, activeLocations: 5 });
      await expect(service.assertLocationAllowedIn(tx as never, TENANT)).resolves.toBeUndefined();
    }
  });

  it("gives an upgrade's room at once, but not after cancelling", async () => {
    const upgraded = setup({ ...paying, nextPlanId: "early_pro" }, { activeLocations: 2 });
    await expect(upgraded.service.assertLocationAllowedIn(upgraded.tx as never, TENANT)).resolves.toBeUndefined();

    const cancelled = setup({ ...paying, nextPlanId: "early_pro", cancelAtPeriodEnd: true }, { activeLocations: 1 });
    await expect(cancelled.service.assertLocationAllowedIn(cancelled.tx as never, TENANT)).rejects.toEqual(isLimit(1));
  });

  it("won't take payment for a plan the salon's active locations don't fit", async () => {
    const { service, payments } = setup({}, { activeLocations: 2 });

    await expect(service.startCheckout("early", "https://api.example.com", "ka")).rejects.toEqual(isLimit(1));
    expect(payments).toHaveLength(0);
    await expect(service.startCheckout("early_pro", "https://api.example.com", "ka")).resolves.toMatchObject({ orderId: expect.any(String) });
  });

  it("won't switch to a smaller plan the salon doesn't fit", async () => {
    const { service, sub } = setup({ ...paying, planId: "early_pro", nextPlanId: "pro" }, { activeLocations: 3 });

    await expect(service.update({ planId: "early" })).rejects.toThrow(ConflictException);
    expect(sub.nextPlanId).toBe("pro");
    await service.update({ planId: "early_pro" });
    expect(sub.nextPlanId).toBeNull();
  });

  it("won't drop a pending upgrade whose room is already used", async () => {
    const { service, sub } = setup({ ...paying, planId: "early", nextPlanId: "early_pro" }, { activeLocations: 2 });

    await expect(service.update({ planId: "early" })).rejects.toEqual(isLimit(1));
    expect(sub.nextPlanId).toBe("early_pro");
  });

  it("tells the CMS the salon's active locations and its limit", async () => {
    const { service } = setup(paying, { activeLocations: 1 });

    expect(await service.overview()).toMatchObject({ activeLocations: 1, locationLimit: 1 });
  });
});

// R550
describe("BillingService — plans edited by the admin", () => {
  const paying = { paidThrough: days(-0.5), rectoken: "tok-1", planId: "early" };

  it("renews at the plan's current price, as the admin last set it", async () => {
    const raised = SEEDED_PLANS.map((row) => (row.id === "early" ? { ...row, price: new Prisma.Decimal("70.00") } : row));
    const { service, flitt } = setup(paying, { plans: raised });
    flitt.recurring.mockImplementation(({ orderId }: { orderId: string }) => Promise.resolve({ order_id: orderId, order_status: "approved", amount: "7000", currency: "GEL" }));

    await service.renewIfDue();

    expect(flitt.recurring).toHaveBeenCalledWith(expect.objectContaining({ amount: 7000 }));
  });

  it("offers owners only the plans marked offered, plus the one they're on", async () => {
    const withdrawn = SEEDED_PLANS.map((row) => (row.id === "early" ? { ...row, offered: false } : row));
    const { service } = setup({ paidThrough: days(20) }, { plans: withdrawn });

    expect((await service.overview()).plans.map((p) => p.id)).toEqual(["early", "early_pro", "pro"]);
    await expect(setup({}, { plans: withdrawn }).service.startCheckout("early", "https://api.example.com", "ka")).rejects.toThrow(BadRequestException);
  });
});

describe("BillingService.adminUpdate", () => {
  it("grants free use and extends the trial from its current end", async () => {
    const { service, sub } = setup();

    const summary = await service.adminUpdate({ free: true, extendTrialDays: 10 });

    expect(summary).toMatchObject({ status: "free", free: true });
    expect(sub.trialEndsAt.getTime()).toBeGreaterThanOrEqual(days(15).getTime() - 1000);
  });

  it("ends a running trial now, so the salon pays from today", async () => {
    const { service, sub } = setup();

    const summary = await service.adminUpdate({ endTrial: true });

    expect(sub.trialEndsAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(summary.status).toBe("past_due");
  });

  it("refuses a nonsense extension", async () => {
    const { service } = setup();

    await expect(service.adminUpdate({ extendTrialDays: 0 })).rejects.toThrow(BadRequestException);
    await expect(service.adminUpdate({ extendTrialDays: 2.5 })).rejects.toThrow(BadRequestException);
  });
});
