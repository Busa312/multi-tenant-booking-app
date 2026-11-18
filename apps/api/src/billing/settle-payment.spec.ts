import { matchesPayment, paymentOutcome, settle, type PaymentRecord, type SubscriptionRecord } from "./settle-payment.js";

const DAY = 86_400_000;
const now = new Date("2026-11-17T12:00:00Z");
const context = { now, cycle: { kind: "month" } as const, retryMs: DAY };
const trialEnd = new Date("2026-11-22T12:00:00Z");

const signup: PaymentRecord = { kind: "signup", status: "pending", planId: "pro", amount: "150.00", periodStart: trialEnd };
const sub: SubscriptionRecord = { planId: "early", nextPlanId: null, paidThrough: null, failedAttempts: 0 };
const approved = { order_status: "approved", amount: "15000", currency: "GEL", rectoken: "tok-1", masked_card: "444455XXXXXX1111", card_type: "VISA", payment_id: 77 };

// R470: one idempotent settlement for callbacks, renewal answers and status checks
describe("settle", () => {
  it("turns an approved checkout into a paid month from the trial's end, with the card saved", () => {
    const result = settle(signup, sub, approved, context);

    expect(result?.payment).toMatchObject({ status: "approved", flittPaymentId: "77", periodStart: trialEnd, periodEnd: new Date("2026-12-22T12:00:00Z") });
    expect(result?.subscription).toMatchObject({
      planId: "pro",
      paidThrough: new Date("2026-12-22T12:00:00Z"),
      rectoken: "tok-1",
      cardMasked: "444455XXXXXX1111",
      cardBrand: "VISA",
      cancelAtPeriodEnd: false,
      failedAttempts: 0,
      retryAt: null,
    });
  });

  it("counts the money once: a payment that already settled changes nothing", () => {
    expect(settle({ ...signup, status: "approved" }, sub, approved, context)).toBeNull();
  });

  it("buys the next month, not the same one, when a second checkout was paid too", () => {
    const paid = { ...sub, paidThrough: new Date("2026-12-22T12:00:00Z") };
    const result = settle(signup, paid, approved, context);

    expect(result?.subscription.paidThrough).toEqual(new Date("2027-01-22T12:00:00Z"));
  });

  it("waits while Flitt is still processing", () => {
    expect(settle(signup, sub, { ...approved, order_status: "processing" }, context)).toBeNull();
    expect(settle(signup, sub, { ...approved, order_status: "created" }, context)).toBeNull();
  });

  it("schedules a retry a day later when a renewal is declined", () => {
    const renewal: PaymentRecord = { ...signup, kind: "renewal", periodStart: new Date("2026-11-17T00:00:00Z") };
    const result = settle(renewal, { ...sub, failedAttempts: 1 }, { order_status: "declined", response_description: "Insufficient funds" }, context);

    expect(result?.payment).toMatchObject({ status: "declined", failureReason: "Insufficient funds" });
    expect(result?.subscription).toEqual({ failedAttempts: 2, retryAt: new Date(now.getTime() + DAY) });
  });

  it("changes nothing on the subscription when a checkout is declined — the owner just tries again", () => {
    expect(settle(signup, sub, { order_status: "declined" }, context)?.subscription).toEqual({});
  });

  it("makes a pending plan switch the plan once its renewal is paid", () => {
    const renewal: PaymentRecord = { kind: "renewal", status: "pending", planId: "pro", amount: "150.00", periodStart: new Date("2026-11-17T00:00:00Z") };
    const result = settle(renewal, { ...sub, nextPlanId: "pro", paidThrough: new Date("2026-11-17T00:00:00Z") }, approved, context);

    expect(result?.subscription).toMatchObject({ planId: "pro", nextPlanId: null, paidThrough: new Date("2026-12-17T00:00:00Z") });
    expect(result?.subscription).not.toHaveProperty("cancelAtPeriodEnd");
  });

  it("replaces the card on a refunded card check, and buys no time", () => {
    const card: PaymentRecord = { kind: "card", status: "pending", planId: null, amount: "1.00", periodStart: null };
    const result = settle(card, sub, { order_status: "reversed", rectoken: "tok-2", masked_card: "555566XXXXXX1111", card_type: "MASTERCARD" }, context);

    expect(result?.payment.status).toBe("approved");
    expect(result?.subscription).toEqual({ rectoken: "tok-2", cardMasked: "555566XXXXXX1111", cardBrand: "MASTERCARD" });
  });
});

describe("paymentOutcome / matchesPayment", () => {
  it("only treats a refund as success for a card check", () => {
    expect(paymentOutcome("reversed", "card")).toBe("approved");
    expect(paymentOutcome("reversed", "renewal")).toBeNull();
  });

  it("accepts only the amount and currency that were asked for", () => {
    expect(matchesPayment({ amount: "15000", currency: "GEL" }, { amount: "150.00" })).toBe(true);
    expect(matchesPayment({ amount: 15000, currency: "GEL" }, { amount: "150.00" })).toBe(true);
    expect(matchesPayment({ amount: "100", currency: "GEL" }, { amount: "150.00" })).toBe(false);
    expect(matchesPayment({ amount: "15000", currency: "USD" }, { amount: "150.00" })).toBe(false);
  });
});
