import { unstable_cache } from "next/cache";
import { PublicApiClient } from "@booking/api-client";
import { DEFAULT_TENANT_COLORS, isValidColor } from "@booking/shared-types";
import type { Tenant, TenantColors } from "@booking/shared-types";

/**
 * Every tenant hits the same API path (`/public/tenant`), differentiated only
 * by the `x-forwarded-host` header — Next's fetch/Data Cache does not key on
 * arbitrary headers, so caching this naively would leak one tenant's config
 * to another. Instead this is cached explicitly via `unstable_cache`, keyed
 * AND tagged by the resolved Host header, so `revalidateTag` can target one
 * tenant's cache entry precisely after a CMS color save (see
 * apps/api/src/cms/revalidation.service.ts + app/api/revalidate/route.ts).
 *
 * `host` must be resolved by the caller (e.g. `headers().get("host")`)
 * *before* calling this — `unstable_cache` callbacks can't call Dynamic APIs
 * like `headers()` themselves.
 */
// Normalizes the same way apps/api's tenant-resolver.service.ts does
// (strip port, lowercase) so this tag matches regardless of whether the
// browser's raw Host header carries a port/case that the API's reconstructed
// `${subdomain}.${baseDomain}` (RevalidationService) doesn't, or vice versa —
// without this, revalidateTag can silently target a tag nothing was cached
// under.
export function tenantHostTag(host: string): string {
  const normalized = host.split(":")[0]!.toLowerCase();
  return `tenant-host:${normalized}`;
}

async function fetchTenant(host: string): Promise<Tenant> {
  const api = new PublicApiClient({
    baseUrl: process.env.API_URL!,
    getExtraHeaders: () => ({ "x-forwarded-host": host }),
  });
  return api.getTenant();
}

export function getCachedTenant(host: string): Promise<Tenant> {
  return unstable_cache(fetchTenant, ["tenant-config", host], {
    tags: [tenantHostTag(host)],
    revalidate: 60,
  })(host);
}

/**
 * Merges platform defaults with the tenant's saved colors, re-validating each
 * value at render time (not just at CMS save time) before it's ever
 * interpolated into a `<style>` tag — defense in depth against a row that
 * somehow ended up with a malformed value.
 */
export function resolveTenantColors(tenant: Pick<Tenant, "configJson">): Required<TenantColors> {
  const provided = tenant.configJson.colors ?? {};
  const resolved = { ...DEFAULT_TENANT_COLORS };

  for (const key of Object.keys(DEFAULT_TENANT_COLORS) as (keyof TenantColors)[]) {
    const value = provided[key];
    if (value && isValidColor(value)) {
      resolved[key] = value;
    }
  }

  return resolved;
}
