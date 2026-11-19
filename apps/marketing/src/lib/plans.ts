import { API_URL } from "astro:env/server";
import type { OfferedPlansResponse, SubscriptionPlan, SubscriptionPlanId } from "@booking/shared-types";

// R560: the plans owners can choose now, read from the API (GET /plans) when
// the site builds — so the page is still static, with the prices in its HTML.
// The platform admin changing a plan (R550) triggers a rebuild through the
// API's deploy hook, so the site follows without anyone editing it.
export type PlanId = SubscriptionPlanId;

export interface MarketingPlan {
  /** Names are the CMS's (its `plan_<id>` messages), translated in the catalogs. */
  id: PlanId;
  /** Monthly price in GEL. Texts are unlimited on every plan (R500). */
  price: number;
  /** Active locations allowed (R540); null = any number. */
  locations: number | null;
  /** R470: offered only during the early-adopter period. */
  early: boolean;
  prioritySupport: boolean;
}

const EARLY: ReadonlySet<PlanId> = new Set(["early", "early_pro"]);

const toMarketingPlan = (plan: SubscriptionPlan): MarketingPlan => ({
  id: plan.id,
  price: Number(plan.price),
  locations: plan.maxLocations,
  early: EARLY.has(plan.id),
  prioritySupport: plan.prioritySupport,
});

// R470's starting values, for builds with no API to ask (CI, a quick local
// build). Never used on Vercel: there a missing API_URL fails the build.
const STARTING_PLANS: SubscriptionPlan[] = [
  { id: "early", price: "60.00", maxLocations: 1, prioritySupport: false },
  { id: "early_pro", price: "90.00", maxLocations: 3, prioritySupport: false },
  { id: "pro", price: "150.00", maxLocations: null, prioritySupport: true },
];

async function fetchPlans(): Promise<SubscriptionPlan[]> {
  if (!API_URL) {
    if (process.env.VERCEL) throw new Error("API_URL is not set: the marketing site can't print the plans");
    console.warn("[plans] API_URL is not set — showing R470's starting plans, not the live ones");
    return STARTING_PLANS;
  }
  // A failure stops the build rather than print wrong prices; the host keeps
  // serving the last good deployment.
  const res = await fetch(new URL("/plans", API_URL), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`GET /plans answered ${res.status}`);
  const { plans } = (await res.json()) as OfferedPlansResponse;
  if (plans.length === 0) throw new Error("GET /plans offered no plans");
  return plans;
}

let loaded: Promise<MarketingPlan[]> | undefined;

/** The offered plans in page order, fetched once per build (both languages share it). */
export const loadPlans = (): Promise<MarketingPlan[]> => (loaded ??= fetchPlans().then((plans) => plans.map(toMarketingPlan)));
