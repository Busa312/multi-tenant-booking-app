import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getPublicApiClient } from "@/lib/api";
import { getCachedTenant, resolveTenantColors } from "@/lib/tenant-config";
import { canonicalOrigin, metadataBaseFor } from "@/lib/site-url";
import { resolveSeo } from "@/lib/seo";
import { buildLocalBusinessJsonLd } from "@/lib/json-ld";
import { JsonLd } from "@/components/JsonLd";
import { PreviewColorListener } from "@/components/PreviewColorListener";

/**
 * Per-tenant <head>.
 *
 * `generateMetadata` runs per request on the server, so `headers()` works here
 * exactly as it does in the layout body. The route is already dynamic for that
 * reason, so this adds no rendering cost — the tenant fetch behind it is memoised
 * and host-tagged by getCachedTenant.
 *
 * The services list is fetched for structured data (offers, derived price range)
 * and to decide whether the site has enough content to be worth indexing.
 */
// Open Graph expects language_TERRITORY; a bare "en" is ignored by several
// scrapers. Mapped rather than derived because there is exactly one territory
// per locale this platform ships.
const OG_LOCALES: Record<string, string> = { en: "en_US", ka: "ka_GE" };

export async function generateMetadata(): Promise<Metadata> {
  const host = headers().get("host") ?? "";
  const [tenant, servicesOrNull] = await Promise.all([
    getCachedTenant(host),
    getPublicApiClient()
      .listServices()
      // Metadata must still render if the services call fails — a missing
      // priceRange is a far better outcome than a page with no <title>.
      // `null` (failed) is kept distinct from `[]` (genuinely no services):
      // feeding a failure in as "no services" would ship `noindex` to a crawler
      // during a transient outage and deindex a working site. Absence of the
      // tag is the safe direction to fail.
      .catch(() => null),
  ]);
  const services = servicesOrNull ?? [];

  const seo = resolveSeo(tenant, servicesOrNull === null || servicesOrNull.length > 0);
  const origin = canonicalOrigin(tenant);
  const metadataBase = metadataBaseFor(tenant);

  return {
    ...(metadataBase ? { metadataBase } : {}),
    title: seo.title,
    description: seo.description,
    // The same tenant is reachable on both its subdomain and a verified custom
    // domain, serving identical HTML. Without this they compete as duplicates.
    //
    // "./" rather than the bare origin: metadata set in a layout is inherited by
    // every route beneath it, so a fixed value here would canonicalise future
    // pages (/services/x) to "/" — silently, and disastrously. Next resolves a
    // relative canonical against metadataBase plus the current pathname.
    ...(origin ? { alternates: { canonical: "./" } } : {}),
    robots: seo.indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: "website",
      title: seo.title,
      description: seo.description,
      siteName: tenant.name,
      locale: OG_LOCALES[seo.lang] ?? OG_LOCALES.en,
      ...(origin ? { url: origin } : {}),
      ...(seo.ogImageUrl ? { images: [seo.ogImageUrl] } : {}),
    },
    twitter: {
      card: seo.ogImageUrl ? "summary_large_image" : "summary",
      title: seo.title,
      description: seo.description,
      ...(seo.ogImageUrl ? { images: [seo.ogImageUrl] } : {}),
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const host = headers().get("host") ?? "";
  const [tenant, services] = await Promise.all([
    getCachedTenant(host),
    getPublicApiClient()
      .listServices()
      .catch(() => []),
  ]);
  const colors = resolveTenantColors(tenant);
  const seo = resolveSeo(tenant, services.length > 0);
  const origin = canonicalOrigin(tenant);
  // JSON-LD has no metadataBase to resolve against, so the generated card's
  // relative path has to be made absolute here or `image` is dropped entirely.
  const absoluteOgImage = seo.ogImageUrl.startsWith("https://")
    ? seo.ogImageUrl
    : origin
      ? `${origin}${seo.ogImageUrl}`
      : null;

  return (
    <html lang={seo.lang}>
      <head>
        {/* No <title> here: generateMetadata owns it. Next does not dedupe
            user-authored head tags against its own, so a hand-written one
            would ship a second <title> element. */}
        <style>{`:root {
  --color-primary: ${colors.primary};
  --color-secondary: ${colors.secondary};
  --color-background: ${colors.background};
  --color-text: ${colors.text};
}`}</style>
        {origin && <JsonLd data={buildLocalBusinessJsonLd(tenant, origin, services, absoluteOgImage)} />}
      </head>
      <body style={{ backgroundColor: "var(--color-background)", color: "var(--color-text)" }}>
        <PreviewColorListener />
        {children}
      </body>
    </html>
  );
}
