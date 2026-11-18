/**
 * R470/R480: billing settings, read once from the environment
 * (system_design.md §12b). Without a Flitt merchant nothing can be paid — the
 * billing endpoints answer 503 and the scheduler stays idle — but statuses,
 * trials and the R490 pause still work.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** R480: every salon's free trial. */
export const TRIAL_DAYS = 14;
export const TRIAL_MS = TRIAL_DAYS * DAY;

/** A billing period: a calendar month (production) or a fixed length (test environments). */
export type BillingCycle = { kind: "month" } | { kind: "fixed"; ms: number };

export interface BillingConfig {
  merchantId: number | null;
  secretKey: string | null;
  /** Base URL Flitt calls back and returns the payer to; null = taken from the request. */
  apiPublicUrl: string | null;
  cmsUrl: string;
  cycle: BillingCycle;
  graceMs: number;
  retryMs: number;
}

const UNITS: Record<string, number> = { s: 1000, m: MINUTE, h: 60 * MINUTE, d: DAY };

/** "30s", "10m", "2h", "7d" → milliseconds; anything else → the fallback. */
export function parseDuration(value: string | undefined, fallbackMs: number): number {
  const match = /^\s*(\d+)\s*([smhd])\s*$/.exec(value ?? "");
  if (!match?.[1] || !match[2]) return fallbackMs;
  const ms = Number(match[1]) * (UNITS[match[2]] ?? 0);
  return ms > 0 ? ms : fallbackMs;
}

export function parseCycle(value: string | undefined): BillingCycle {
  if (value === undefined || value.trim() === "" || value.trim() === "month") return { kind: "month" };
  const ms = parseDuration(value, 0);
  return ms > 0 ? { kind: "fixed", ms } : { kind: "month" };
}

/**
 * One period after `from`. A month is the same day and time next month in UTC,
 * clamped to the month's last day (31 Jan → 28/29 Feb).
 */
export function addCycle(from: Date, cycle: BillingCycle): Date {
  if (cycle.kind === "fixed") return new Date(from.getTime() + cycle.ms);
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(from.getUTCDate(), lastDay),
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
}

export function billingConfig(get: (key: string) => string | undefined): BillingConfig {
  const merchantId = Number(get("FLITT_MERCHANT_ID"));
  const secretKey = get("FLITT_SECRET_KEY")?.trim() ?? "";
  // Both or neither: half a merchant can't sign anything.
  const merchant = Number.isInteger(merchantId) && merchantId > 0 && secretKey !== "";
  return {
    merchantId: merchant ? merchantId : null,
    secretKey: merchant ? secretKey : null,
    apiPublicUrl: get("API_PUBLIC_URL")?.trim().replace(/\/+$/, "") || null,
    cmsUrl: (get("CMS_URL")?.trim() || "http://localhost:5173").replace(/\/+$/, ""),
    cycle: parseCycle(get("BILLING_CYCLE")),
    graceMs: parseDuration(get("BILLING_GRACE"), 7 * DAY),
    retryMs: parseDuration(get("BILLING_RETRY"), DAY),
  };
}

export function billingConfigured(config: BillingConfig): config is BillingConfig & { merchantId: number; secretKey: string } {
  return config.merchantId !== null && config.secretKey !== null;
}
