import type { AppointmentStatus, AppointmentSummary } from "@booking/shared-types";
import { tenantDateString } from "./tenantTime.js";

/**
 * What the dashboard derives in the browser: today's agenda, from one
 * `listAppointments` payload. The longer-range numbers (R370) come computed
 * from `GET /cms/dashboard`; see `dashboardSummary.ts` for how they're shown.
 *
 * Deliberately free of React, `cachedApi` and (except `formatMinor`) `Intl`:
 * the arithmetic here is where a dashboard quietly lies — a UTC-bucketed day,
 * a float-summed total — so it stays separately readable and testable from the
 * components that render it.
 */

// ---------------------------------------------------------------- the window

export interface DashboardRange {
  /** Tenant-local "YYYY-MM-DD". */
  from: string;
  /** Tenant-local "YYYY-MM-DD" — the salon's today, not the browser's. */
  to: string;
}

/**
 * The range the agenda fetches: just the salon's today. The API makes `to`
 * inclusive to the *next* tenant-local midnight (see `resolveRange` in
 * appointments.controller.ts), so this covers appointments still to come this
 * evening.
 */
export function dashboardRange(timezone: string, now: Date = new Date()): DashboardRange {
  const today = tenantDateString(timezone, now);
  return { from: today, to: today };
}

// ------------------------------------------------------- the inclusion rule

/**
 * A "held" appointment: one the salon expects to perform, or has performed.
 *
 * `cancelled` never happened — the row survives only as history (R90 of
 * TBUK-010) — and a `no_show` produced no service and no money. Every aggregate
 * on this dashboard funnels through this one predicate, so the count and the
 * value in the same table row can never disagree with each other. Excluded rows
 * are disclosed in a footnote rather than dropped in silence.
 */
export function isHeld(status: AppointmentStatus): boolean {
  return status === "booked" || status === "completed";
}

// ------------------------------------------------------------------- money

/**
 * `price` arrives as a decimal *string* — the API transports `Decimal(10,2)`
 * that way precisely so no float ever touches it. Parsing to integer minor
 * units (tetri) keeps that guarantee through summation: `parseFloat` + `+=`
 * accumulates binary drift and renders `1234.5600000000001` after a few
 * hundred adds, which is not something an owner should read as a total.
 *
 * Returns null for anything not shaped like `Decimal(10,2)`, so an unexpected
 * value is footnoted rather than silently counted as zero.
 */
const PRICE_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

export function parsePriceMinor(price: string): number | null {
  const match = PRICE_PATTERN.exec(price.trim());
  if (match === null) return null;
  // noUncheckedIndexedAccess: capture groups are `string | undefined` even when
  // the pattern guarantees group 1, so the whole part is checked rather than
  // asserted.
  const whole = match[1];
  if (whole === undefined) return null;
  const fraction = (match[2] ?? "").padEnd(2, "0");
  return Number(whole) * 100 + Number(fraction);
}

/**
 * Minor units back to a display string. The single division in the whole money
 * path happens here, once, at the end — never inside a running total.
 */
export function formatMinor(minor: number, lang: string): string {
  return new Intl.NumberFormat(lang, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

// ------------------------------------------------------- widget: the agenda

export interface TodaysAgenda {
  /** Every appointment starting today, by start time. Cancelled ones included. */
  all: AppointmentSummary[];
  /** The first still-running-or-upcoming `booked` row; null once the day is done. */
  nextUp: AppointmentSummary | null;
  /** `all` minus `nextUp`, order preserved. */
  rest: AppointmentSummary[];
  /** Held appointments today — the header count. */
  heldCount: number;
}

/**
 * Today's book. `nextUp` looks at `endAt` rather than `startAt` so the
 * appointment in the chair right now stays the highlighted one until it
 * actually finishes, and skips non-`booked` rows: a completed or cancelled
 * appointment isn't what anyone is about to do next.
 */
export function todaysAgenda(
  appointments: readonly AppointmentSummary[],
  timezone: string,
  now: Date,
): TodaysAgenda {
  const today = tenantDateString(timezone, now);
  const all = appointments
    .filter((appointment) => tenantDateString(timezone, new Date(appointment.startAt)) === today)
    .slice()
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const nextUp = all.find((a) => a.status === "booked" && new Date(a.endAt).getTime() > now.getTime()) ?? null;

  return {
    all,
    nextUp,
    rest: nextUp ? all.filter((a) => a.id !== nextUp.id) : all,
    heldCount: all.filter((a) => isHeld(a.status)).length,
  };
}
