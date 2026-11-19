import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getCachedTenant } from "@/lib/tenant-config";
import { siteOrigin } from "@/lib/site-url";
import { searchEnginesBlocked } from "@/lib/search-indexing";

// One robots.txt per salon, since each has its own host. A booking's manage
// link is a credential and never for indexing, in any language.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = siteOrigin();
  const salon = await getCachedTenant(headers().get("host") ?? "").catch(() => null);
  if (!salon) {
    // A host no salon owns: nothing here to index.
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  const rules = { userAgent: "*", allow: "/", disallow: ["/manage/", "/*/manage/", "/embed/", "/*/embed/", "/api/"] };
  // R390: on staging no sitemap is offered; pages carry X-Robots-Tag noindex
  // instead of being disallowed here, since a crawler must fetch a page to see it.
  if (searchEnginesBlocked()) return { rules };
  return { rules, sitemap: `${origin}/sitemap.xml` };
}
