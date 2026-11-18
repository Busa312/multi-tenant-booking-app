import type { SubscriptionStatus } from "@booking/shared-types";

/** The stored facts a subscription's status is derived from (R480). */
export interface StatusFacts {
  free: boolean;
  trialEndsAt: Date;
  paidThrough: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface DerivedStatus {
  status: SubscriptionStatus;
  /** Trial end or paid-through, whichever is later. */
  accessUntil: Date;
  /** Booking pauses at this instant if nothing is paid (only while past_due). */
  graceEndsAt: Date | null;
  /** R490 */
  bookingPaused: boolean;
}

/**
 * R480: a salon's status, from facts alone — never stored, so it can't go stale
 * and nothing has to flip it at midnight.
 *
 * Paying during the trial makes the salon `active` at once. A cancelled
 * subscription has no grace: it lapses the moment its paid month ends.
 */
export function deriveStatus(facts: StatusFacts, now: Date, graceMs: number): DerivedStatus {
  const paid = facts.paidThrough?.getTime() ?? Number.NEGATIVE_INFINITY;
  const accessUntil = new Date(Math.max(facts.trialEndsAt.getTime(), paid));
  const at = now.getTime();

  if (facts.free) return { status: "free", accessUntil, graceEndsAt: null, bookingPaused: false };
  if (at < paid) return { status: "active", accessUntil, graceEndsAt: null, bookingPaused: false };
  if (at < facts.trialEndsAt.getTime()) return { status: "trial", accessUntil, graceEndsAt: null, bookingPaused: false };

  const cancelledAndEnded = facts.cancelAtPeriodEnd && facts.paidThrough !== null;
  const graceEndsAt = new Date(accessUntil.getTime() + graceMs);
  if (!cancelledAndEnded && at < graceEndsAt.getTime()) {
    return { status: "past_due", accessUntil, graceEndsAt, bookingPaused: false };
  }
  return { status: "lapsed", accessUntil, graceEndsAt: null, bookingPaused: true };
}

/** What the scheduler needs to know about a subscription to decide on a renewal. */
export interface RenewalFacts extends StatusFacts {
  rectoken: string | null;
  retryAt: Date | null;
}

/**
 * R470: whether the platform should charge the saved card now. Only inside the
 * grace period: once a salon has lapsed, paying again is the owner's move (a
 * new checkout), so a card isn't charged weeks after the salon stopped using
 * the service.
 */
export function renewalDue(facts: RenewalFacts, now: Date, graceMs: number): boolean {
  if (facts.free || facts.cancelAtPeriodEnd || !facts.rectoken || !facts.paidThrough) return false;
  const at = now.getTime();
  const end = facts.paidThrough.getTime();
  if (at < end || at >= end + graceMs) return false;
  return facts.retryAt === null || at >= facts.retryAt.getTime();
}

/**
 * When a new paid month starts if the owner pays now: at the end of the trial
 * or paid month while the salon still has access or is in grace — so trial
 * days aren't lost and grace days are paid for — or now, once it has lapsed.
 */
export function nextPeriodStart(derived: DerivedStatus, now: Date): Date {
  return derived.status === "lapsed" ? now : derived.accessUntil;
}
