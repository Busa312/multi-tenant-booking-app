import { ApiError } from "@booking/api-client";
import type { PlanLocationLimitResponse } from "@booking/shared-types";

/**
 * R540: the API refuses a location beyond the plan's limit with
 * `code: "plan_location_limit"` and the limit. Returns that limit, or null for
 * every other failure.
 */
export function locationLimitFromError(err: unknown): number | null {
  if (!(err instanceof ApiError)) return null;
  const body = err.body as Partial<PlanLocationLimitResponse> | undefined;
  return body?.code === "plan_location_limit" && typeof body.limit === "number" ? body.limit : null;
}
