import type { Tenant } from "@booking/shared-types";

/**
 * The one hostname a tenant's site should be known by.
 *
 * Deliberately derived from *tenant data*, never from the incoming request:
 *
 *  - The `Host` header is attacker-controlled. Today it only feeds a lookup
 *    that fails closed with a 404, but a canonical link or `og:url` built from
 *    it would be free text emitted into crawler-visible HTML — an SEO-poisoning
 *    primitive.
 *  - `x-forwarded-proto` is not dependable either: behind chained proxies it can
 *    arrive as a comma list ("https, http"), and in docker-compose there is no
 *    proxy setting it at all.
 *
 * Every consumer — canonical, og:url, JSON-LD url/@id, robots — must go through
 * here. A canonical that disagrees with og:url is itself a negative signal.
 */

// Same "is this custom domain live?" predicate as apps/api's
// tenant-resolver.service.ts (which will only resolve a custom domain when
// domainVerifiedAt is set) and revalidation.service.ts (which only pings it
// under the same condition). Kept as its own named function so the three
// copies are greppable.
export function canonicalHost(tenant: Pick<Tenant, "subdomain" | "customDomain" | "domainVerifiedAt">): string {
  if (tenant.customDomain && tenant.domainVerifiedAt) {
    return tenant.customDomain;
  }
  const baseDomain = process.env.PUBLIC_SITE_BASE_DOMAIN;
  if (!baseDomain) {
    // Loud, because the failure is otherwise invisible: with no origin the page
    // silently drops its canonical, og:url and the whole JSON-LD block, and
    // still returns 200 with a plausible-looking <head>. That is the single
    // most likely way this feature "deploys fine" and does nothing.
    console.warn(
      "[seo] PUBLIC_SITE_BASE_DOMAIN is not set — canonical URL, og:url and structured data will be omitted.",
    );
    // Falling back to the bare subdomain would emit a canonical pointing at a
    // hostname that doesn't resolve, which is worse than emitting none.
    return "";
  }
  return `${tenant.subdomain}.${baseDomain}`;
}

export function canonicalOrigin(
  tenant: Pick<Tenant, "subdomain" | "customDomain" | "domainVerifiedAt">,
): string | null {
  const host = canonicalHost(tenant);
  if (!host) {
    return null;
  }
  const protocol = process.env.PUBLIC_SITE_PROTOCOL ?? "https";
  return `${protocol}://${host}`;
}

/**
 * `metadataBase` is not optional decoration: with it unset, Next resolves
 * relative metadata URLs (the OG image) against VERCEL_PROJECT_PRODUCTION_URL,
 * which on a multi-tenant deployment is the *platform* domain — so every
 * tenant's share image would point at the wrong host.
 */
export function metadataBaseFor(
  tenant: Pick<Tenant, "subdomain" | "customDomain" | "domainVerifiedAt">,
): URL | null {
  const origin = canonicalOrigin(tenant);
  return origin ? new URL(origin) : null;
}
