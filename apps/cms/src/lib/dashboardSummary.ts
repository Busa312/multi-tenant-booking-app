import type { DashboardDay } from "@booking/shared-types";
import { parsePriceMinor } from "./dashboardStats.js";

/**
 * R370: turning `GET /cms/dashboard` numbers into what the cards print. The
 * API sends counts; every ratio and comparison is made here, once, so two
 * cards can never round the same number differently.
 */

/** The length of the API's rolling periods, for labels. */
export const DASHBOARD_PERIOD_DAYS = 30;

/** part ÷ whole as 0–1, or null when there's nothing to divide by. */
export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

/** How full a day is, 0–1 (can pass 1 when bookings run over hours); null when nobody works. */
export function occupancy(day: DashboardDay): number | null {
  return ratio(day.bookedMinutes, day.workingMinutes);
}

/**
 * Relative change from `previous` to `current` (0.25 = up a quarter). Null
 * when there's no previous figure to compare with: "up ∞%" helps nobody.
 */
export function relativeChange(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null;
}

/** A 0–1 value as a whole percentage in the CMS language. */
export function formatPercent(value: number, lang: string): string {
  return new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 0 }).format(value);
}

/** A change as a signed percentage ("+25%", "−10%"). */
export function formatChange(value: number, lang: string): string {
  return new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" }).format(
    value,
  );
}

/** A decimal-string amount rounded to whole lari, for a headline figure. */
export function formatWholeAmount(value: string, lang: string): string {
  const minor = parsePriceMinor(value);
  if (minor === null) return value;
  return new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(Math.round(minor / 100));
}
