import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/index.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";
import { BillingService, orderIdFor, tenantOfOrder } from "./billing.service.js";
import type { FlittClient, FlittOrder } from "./flitt.client.js";
import type { RevalidationService } from "../cms/revalidation.service.js";

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
  options: { configured?: boolean; smsParts?: number; payments?: Partial<PaymentRow>[] } = {},
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
  const service = new BillingService(prisma, tenantContext, flitt as unknown as FlittClient, revalidation as unknown as RevalidationService);
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

  // R500
  it("adds the month just ended's extra texts to the renewal, as one charge", async () => {
    const ended = { periodStart: days(-30.5), periodEnd: days(-0.5) };
    const { service, flitt, payments, tx } = setup(paying, { smsParts: 620, payments: [ended] });
    flitt.recurring.mockImplementation(({ orderId }: { orderId: string }) =>
      Promise.resolve({ order_id: orderId, order_status: "approved", amount: "6140", currency: "GEL" }),
    );

    await expect(service.renewIfDue(new Date(now))).resolves.toBe("settled");

    expect(flitt.recurring).toHaveBeenCalledWith(expect.objectContaining({ amount: 6140, description: "Subscription: early plan + 20 extra texts" }));
    const renewal = payments.find((p) => p.kind === "renewal");
    expect(renewal).toMatchObject({ extraTexts: 20, extraTextsFrom: ended.periodStart, status: "approved" });
    expect((renewal?.extraTextsAmount as Prisma.Decimal).toFixed(2)).toBe("1.40");
    expect(Number(renewal?.amount)).toBe(61.4);
    // Counted over exactly the month that ended.
    const where = tx.smsMessage.aggregate.mock.calls[0]?.[0]?.where as { sentAt: { gte: Date; lt: Date } };
    expect(where.sentAt).toEqual({ gte: ended.periodStart, lt: paying.paidThrough });
  });

  it("charges extra texts against the allowance of the plan the month was paid for, not the next one", async () => {
    const ended = { periodStart: days(-30.5), periodEnd: days(-0.5) };
    const { service, flitt } = setup({ ...paying, nextPlanId: "pro" }, { smsParts: 620, payments: [ended] });
    flitt.recurring.mockImplementation(({ orderId }: { orderId: string }) =>
      Promise.resolve({ order_id: orderId, order_status: "approved", amount: "15140", currency: "GEL" }),
    );

    await service.renewIfDue(new Date(now));

    // Early's 600 texts, not Pro's 1,500: 20 extra on top of Pro's price.
    expect(flitt.recurring).toHaveBeenCalledWith(expect.objectContaining({ amount: 15140 }));
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
describe("BillingService.overview — texts this month", () => {
  it("sums this calendar month's SMS parts against the plan's allowance", async () => {
    const { service, tx } = setup({ planId: "pro" }, { smsParts: 214 });

    const { sms } = await service.overview();

    expect(sms).toMatchObject({ used: 214, included: 1500 });
    const where = tx.smsMessage.aggregate.mock.calls[0]?.[0]?.where as { tenantId: string; sentAt: { gte: Date; lt: Date } };
    expect(where.tenantId).toBe(TENANT);
    expect(where.sentAt.gte.toISOString()).toBe(sms.periodStart);
    expect(where.sentAt.lt.toISOString()).toBe(sms.periodEnd);
  });

  it("is zero, not missing, in a month with no texts", async () => {
    const { service } = setup();

    expect((await service.overview()).sms).toMatchObject({ used: 0, included: 600 });
  });

  it("counts a trial's texts by calendar month and never charges them", async () => {
    const { service } = setup({}, { smsParts: 650 });

    expect((await service.overview()).sms).toMatchObject({ billingMonth: false, billable: false, extra: 50, extraAmount: "3.50" });
  });

  it("counts a paying salon's texts over its paid month, and prices what's extra at 0.07 ₾", async () => {
    const start = days(-10);
    const end = days(20);
    const { service } = setup(
      { trialEndsAt: days(-30), paidThrough: end },
      { smsParts: 620, payments: [{ periodStart: start, periodEnd: end }] },
    );

    const { sms } = await service.overview();

    expect(sms).toMatchObject({
      billingMonth: true,
      billable: true,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      used: 620,
      extra: 20,
      extraAmount: "1.40",
      extraTextPrice: "0.07",
    });
  });
});

// R430/R480
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
