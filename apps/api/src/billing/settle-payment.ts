import type { SubscriptionPaymentKind, SubscriptionPaymentStatus } from "@booking/shared-types";
import { addCycle, type BillingCycle } from "./billing-config.js";
import { toMinorUnits } from "./plans.js";
import type { FlittOrder } from "./flitt.client.js";

/** The payment as recorded when it was started. */
export interface PaymentRecord {
  kind: SubscriptionPaymentKind;
  status: SubscriptionPaymentStatus;
  planId: string | null;
  /** GEL, two decimals. */
  amount: string;
  periodStart: Date | null;
}

/** The subscription facts a settlement reads. */
export interface SubscriptionRecord {
  planId: string;
  nextPlanId: string | null;
  paidThrough: Date | null;
  failedAttempts: number;
}

export interface Settlement {
  payment: {
    status: SubscriptionPaymentStatus;
    settledAt: Date;
    flittPaymentId: string | null;
    cardMasked: string | null;
    failureReason: string | null;
    periodStart?: Date;
    periodEnd?: Date;
  };
  subscription: {
    planId?: string;
    nextPlanId?: string | null;
    paidThrough?: Date;
    cancelAtPeriodEnd?: boolean;
    failedAttempts?: number;
    retryAt?: Date | null;
    rectoken?: string;
    cardMasked?: string | null;
    cardBrand?: string | null;
  };
}

/** Flitt's order status → ours, for this kind of payment. null = not final yet (or not ours to act on). */
export function paymentOutcome(orderStatus: unknown, kind: SubscriptionPaymentKind): Exclude<SubscriptionPaymentStatus, "pending"> | null {
  switch (orderStatus) {
    case "approved":
      return "approved";
    // A card check is refunded automatically once approved; that's its success.
    case "reversed":
      return kind === "card" ? "approved" : null;
    case "declined":
      return "declined";
    case "expired":
      return "expired";
    default:
      return null;
  }
}

/** The order is the one we started: same money, same currency. */
export function matchesPayment(order: FlittOrder, payment: Pick<PaymentRecord, "amount">): boolean {
  return String(order.amount) === String(toMinorUnits(payment.amount)) && order.currency === "GEL";
}

const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : typeof value === "number" ? String(value) : null);

/**
 * R470: what a Flitt result changes. Pure, and idempotent by construction —
 * only a pending payment settles, so a callback, a renewal's own answer and a
 * status check can all arrive, in any order, and the money counts once.
 *
 * A paid month starts where the subscription's paid time ends, never earlier:
 * if two checkouts were both paid, the second buys the month after the first
 * instead of paying for the same month twice.
 */
export function settle(
  payment: PaymentRecord,
  subscription: SubscriptionRecord,
  order: FlittOrder,
  context: { now: Date; cycle: BillingCycle; retryMs: number },
): Settlement | null {
  if (payment.status !== "pending") return null;
  const outcome = paymentOutcome(order.order_status, payment.kind);
  if (outcome === null) return null;

  const settlement: Settlement = {
    payment: {
      status: outcome,
      settledAt: context.now,
      flittPaymentId: text(order.payment_id),
      cardMasked: text(order.masked_card),
      failureReason: outcome === "approved" ? null : text(order.response_description),
    },
    subscription: {},
  };

  if (outcome !== "approved") {
    // A failed renewal waits a day; a failed checkout changes nothing — the owner just tries again.
    if (payment.kind === "renewal") {
      settlement.subscription.failedAttempts = subscription.failedAttempts + 1;
      settlement.subscription.retryAt = new Date(context.now.getTime() + context.retryMs);
    }
    return settlement;
  }

  const rectoken = text(order.rectoken);
  if (rectoken) {
    settlement.subscription.rectoken = rectoken;
    settlement.subscription.cardMasked = text(order.masked_card);
    settlement.subscription.cardBrand = text(order.card_type);
  }

  if (payment.kind === "card" || payment.planId === null || payment.periodStart === null) return settlement;

  const start = new Date(Math.max(payment.periodStart.getTime(), subscription.paidThrough?.getTime() ?? 0));
  const end = addCycle(start, context.cycle);
  settlement.payment.periodStart = start;
  settlement.payment.periodEnd = end;
  Object.assign(settlement.subscription, {
    planId: payment.planId,
    // The switch it carried is now the plan.
    nextPlanId: subscription.nextPlanId === payment.planId ? null : subscription.nextPlanId,
    paidThrough: end,
    failedAttempts: 0,
    retryAt: null,
    // Paying again after cancelling is changing your mind.
    ...(payment.kind === "signup" ? { cancelAtPeriodEnd: false } : {}),
  });
  return settlement;
}
