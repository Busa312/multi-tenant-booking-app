import { zonedMonth } from "../common/timezone.js";
import { addCycle, type BillingCycle } from "./billing-config.js";
import type { DerivedStatus } from "./subscription-status.js";

/** R500: what one text beyond the allowance costs, in GEL and in tetri. */
export const EXTRA_TEXT_PRICE = "0.07";
const EXTRA_TEXT_TETRI = 7;

/** R500: the owner is warned from this share of the allowance on. */
export const SMS_WARNING_SHARE = 0.8;

export interface UsageWindow {
  start: Date;
  /** Exclusive. */
  end: Date;
  /** "billing" = the salon's paid month; "calendar" = outside one (trial, free use, lapsed). */
  kind: "billing" | "calendar";
  /** Whether extra texts in this window will be charged (at the renewal that ends it). */
  billable: boolean;
}

/**
 * R500: the stretch of time whose texts count together right now.
 *
 * Inside a paid month it's that month. Between the end of a paid month and
 * the renewal that follows (past due), it's the month that renewal will buy —
 * texts then are charged with the renewal after it, so nothing falls between
 * two months. Everywhere else — the trial (even when it's already paid for
 * from its end), free use, a lapsed salon — it's the calendar month on the
 * salon's clock, and nothing is charged. A cancelled subscription's last month
 * has no renewal after it, so its extra texts aren't charged either.
 */
export function usageWindow(input: {
  derived: DerivedStatus;
  paidThrough: Date | null;
  /** Start of the paid month ending at `paidThrough`; null if unknown. */
  currentPeriodStart: Date | null;
  cancelAtPeriodEnd: boolean;
  now: Date;
  cycle: BillingCycle;
  timeZone: string;
}): UsageWindow {
  const { derived, paidThrough, currentPeriodStart, now } = input;
  const paying = derived.status === "active" || derived.status === "past_due";
  if (paying && paidThrough) {
    if (now.getTime() >= paidThrough.getTime()) {
      return { start: paidThrough, end: addCycle(paidThrough, input.cycle), kind: "billing", billable: true };
    }
    if (currentPeriodStart && currentPeriodStart.getTime() <= now.getTime()) {
      return { start: currentPeriodStart, end: paidThrough, kind: "billing", billable: !input.cancelAtPeriodEnd };
    }
  }
  const month = zonedMonth(now, input.timeZone);
  return { start: month.start, end: month.end, kind: "calendar", billable: false };
}

/** R500: texts beyond the allowance, and their price — integer tetri, so no float rounding. */
export function extraTexts(used: number, included: number): { count: number; amount: string; tetri: number } {
  const count = Math.max(0, used - included);
  const tetri = count * EXTRA_TEXT_TETRI;
  return { count, tetri, amount: (tetri / 100).toFixed(2) };
}
