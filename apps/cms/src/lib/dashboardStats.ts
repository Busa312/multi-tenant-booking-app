import type { AppointmentStatus, AppointmentSummary } from "@booking/shared-types";
import { addDays, tenantDateString } from "./tenantTime.js";

/**
 * Everything the dashboard derives from one `listAppointments` payload.
 *
 * Deliberately free of React, `cachedApi` and (except `formatMinor`) `Intl`:
 * the arithmetic here is where a dashboard quietly lies — a UTC-bucketed day,
 * a float-summed total — so it stays separately readable and testable from the
 * components that render it.
 */

/** The trend window, in days, counting back from and including the salon's today. */
export const TREND_DAYS = 30;

/** How many services the "top services" table lists. */
export const TOP_SERVICES_LIMIT = 5;

// ---------------------------------------------------------------- the window

export interface DashboardRange {
  /** Tenant-local "YYYY-MM-DD", TREND_DAYS-1 days before `to`. */
  from: string;
  /** Tenant-local "YYYY-MM-DD" — the salon's today, not the browser's. */
  to: string;
}

/**
 * The single range the page fetches. The API makes `to` inclusive to the *next*
 * tenant-local midnight (see `resolveRange` in appointments.controller.ts), so
 * one call covers the 30-day history and the whole of today, including
 * appointments still to come this evening.
 */
export function dashboardRange(timezone: string, now: Date = new Date()): DashboardRange {
  const today = tenantDateString(timezone, now);
  return { from: addDays(today, -(TREND_DAYS - 1)), to: today };
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

// -------------------------------------------------------- widget: the trend

export interface TrendPoint {
  /** Tenant-local "YYYY-MM-DD". */
  date: string;
  /** Held appointments that day. */
  count: number;
  /** Cancelled + no-show that day — disclosed, never silently dropped. */
  excluded: number;
}

export interface BookingTrend {
  /** Exactly TREND_DAYS entries, gap-filled, oldest first. */
  points: TrendPoint[];
  total: number;
  excludedTotal: number;
  /** The busiest day's count; 0 for a tenant with no bookings. */
  peak: number;
  /** The first day that hit `peak`; null when `total` is 0. */
  peakPoint: TrendPoint | null;
  /** Days with at least one held appointment — drives the degrade-to-text rule. */
  nonZeroDays: number;
  /**
   * What a full-height bar means. Floored at 4 so a lone booking renders as a
   * quarter-height mark rather than implying a packed day.
   */
  scaleMax: number;
}

/**
 * Daily counts across the window.
 *
 * Bucketing goes through `tenantDateString`, never `startAt.slice(0, 10)`: the
 * latter is the *UTC* day, which for Asia/Tbilisi (UTC+4) files every
 * appointment from 20:00 onwards under tomorrow. That would misreport both the
 * trend and — via the same helper — the agenda.
 *
 * Gap-filling walks the calendar rather than the map, so a day with no bookings
 * is a zero in the series instead of a missing column that silently compresses
 * the axis.
 */
export function buildTrend(
  appointments: readonly AppointmentSummary[],
  timezone: string,
  range: DashboardRange,
): BookingTrend {
  const buckets = new Map<string, { count: number; excluded: number }>();

  for (const appointment of appointments) {
    const day = tenantDateString(timezone, new Date(appointment.startAt));
    const bucket = buckets.get(day) ?? { count: 0, excluded: 0 };
    if (isHeld(appointment.status)) {
      bucket.count += 1;
    } else {
      bucket.excluded += 1;
    }
    buckets.set(day, bucket);
  }

  // Walks back from `range.to` rather than forward from `range.from`, so the
  // last point is always the salon's today — the invariant the chart's "today"
  // ring and axis label rely on, regardless of how wide the range is.
  const points: TrendPoint[] = [];
  for (let offset = TREND_DAYS - 1; offset >= 0; offset -= 1) {
    const date = addDays(range.to, -offset);
    const bucket = buckets.get(date) ?? { count: 0, excluded: 0 };
    points.push({ date, count: bucket.count, excluded: bucket.excluded });
  }

  const total = points.reduce((sum, point) => sum + point.count, 0);
  const excludedTotal = points.reduce((sum, point) => sum + point.excluded, 0);
  const peak = points.reduce((max, point) => (point.count > max ? point.count : max), 0);

  return {
    points,
    total,
    excludedTotal,
    peak,
    peakPoint: total === 0 ? null : (points.find((point) => point.count === peak) ?? null),
    nonZeroDays: points.filter((point) => point.count > 0).length,
    scaleMax: Math.max(peak, 4),
  };
}

// ------------------------------------------------------- widget: top services

export interface TopServiceStat {
  serviceId: string;
  serviceName: string;
  count: number;
  /** Expected value in minor units. Owner-only at the render site. */
  valueMinor: number;
  /** Rows whose price didn't parse — footnoted, not hidden. */
  unpriced: number;
}

/**
 * Busiest services over the window, by held-appointment count.
 *
 * The value is *expected*: the price snapshotted when each appointment was
 * booked (R40 of TBUK-010), for appointments that are booked or completed. The
 * product is reservation-only and customers pay in person, so this is never a
 * record of money received.
 */
export function topServices(
  appointments: readonly AppointmentSummary[],
  limit: number = TOP_SERVICES_LIMIT,
): TopServiceStat[] {
  const byService = new Map<string, TopServiceStat>();

  for (const appointment of appointments) {
    if (!isHeld(appointment.status)) continue;

    const stat = byService.get(appointment.serviceId) ?? {
      serviceId: appointment.serviceId,
      serviceName: appointment.serviceName,
      count: 0,
      valueMinor: 0,
      unpriced: 0,
    };
    stat.count += 1;
    const minor = parsePriceMinor(appointment.price);
    if (minor === null) {
      stat.unpriced += 1;
    } else {
      stat.valueMinor += minor;
    }
    byService.set(appointment.serviceId, stat);
  }

  // Count desc, then value desc, then name — so equal-count rows have a stable
  // order instead of shuffling with Map insertion order between renders.
  return [...byService.values()]
    .sort((a, b) => b.count - a.count || b.valueMinor - a.valueMinor || a.serviceName.localeCompare(b.serviceName))
    .slice(0, limit);
}
