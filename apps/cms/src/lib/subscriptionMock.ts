/**
 * MOCK DATA. Billing isn't built yet: there is no payment provider, no
 * subscription table and no API behind any of this. The Subscription page
 * reads these fixtures so its layout and wording can be settled first; the
 * plan figures follow ROADMAP.md §4. When the real thing exists, these types
 * move to `@booking/shared-types` and the page loads them through `cachedApi`.
 */

export type PlanId = "early" | "standard" | "pro";

export interface Plan {
  id: PlanId;
  /** GEL per month. */
  price: number;
  /** Texts included each month. */
  smsIncluded: number;
  /** i18n keys of what the plan adds, shown as a list. */
  featureKeys: string[];
}

export interface Invoice {
  id: string;
  /** Any day of the month billed, "YYYY-MM-DD". */
  period: string;
  /** GEL, two decimals — a string, as money is on the wire everywhere else. */
  amount: string;
}

export interface Subscription {
  planId: PlanId;
  /** "YYYY-MM-DD" */
  renewsOn: string;
  smsUsed: number;
  /** GEL per text beyond the included ones. */
  extraSmsPrice: string;
  card: { brand: string; last4: string; expires: string };
  invoices: Invoice[];
}

export const MOCK_PLANS: readonly Plan[] = [
  { id: "early", price: 60, smsIncluded: 600, featureKeys: ["subscription.featureBooking", "subscription.featureOneLocation", "subscription.featureEarlyPrice"] },
  { id: "standard", price: 90, smsIncluded: 600, featureKeys: ["subscription.featureBooking", "subscription.featureOneLocation", "subscription.featureReminders"] },
  { id: "pro", price: 150, smsIncluded: 1500, featureKeys: ["subscription.featureBooking", "subscription.featureManyLocations", "subscription.featureReminders", "subscription.featurePriority"] },
];

export const MOCK_SUBSCRIPTION: Subscription = {
  planId: "early",
  renewsOn: "2026-12-01",
  smsUsed: 214,
  extraSmsPrice: "0.07",
  card: { brand: "Visa", last4: "4242", expires: "08/28" },
  invoices: [
    { id: "inv-2026-11", period: "2026-11-01", amount: "60.00" },
    { id: "inv-2026-10", period: "2026-10-01", amount: "60.00" },
    { id: "inv-2026-09", period: "2026-09-01", amount: "63.15" },
  ],
};
