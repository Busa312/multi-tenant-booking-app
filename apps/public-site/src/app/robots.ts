import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getCachedTenant } from "@/lib/tenant-config";
import { canonicalHost } from "@/lib/site-url";

/**
 * Per-tenant robots.txt.
 *
 * `robots.ts` is compiled into an ordinary App Router route handler that
 * re-exports this config, so `headers()` works and the output is genuinely
 * per-request — only the *static asset* form (a literal robots.txt file) is
 * forced static.
 */
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHost = headers().get("host") ?? "";
  const tenant = await getCachedTenant(requestHost);
  const host = canonicalHost(tenant);

  return {
    // Always crawlable, even for a tenant hidden from search.
    //
    // `Disallow: /` would be the intuitive way to hide a site and it is exactly
    // wrong: a blocked page cannot be crawled, so the `noindex` meta tag is
    // never read, and the URL can still surface in results as a bare link. The
    // meta tag from generateMetadata is what does the hiding.
    //
    // For the same family of reasons the non-canonical subdomain is not
    // disallowed either — Google can propagate a noindex across a canonical
    // cluster to the target, which would deindex the real site.
    rules: [{ userAgent: "*", allow: "/" }],
    // A bare hostname — the directive takes no scheme.
    ...(host ? { host } : {}),
  };
}
