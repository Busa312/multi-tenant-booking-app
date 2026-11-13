import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { defaultLocaleOf } from "@booking/shared-types";
import { isLocale } from "@/i18n/locales";
import { localePath } from "@/lib/locale-path";
import { getCachedTenant } from "@/lib/tenant-config";
import { siteOrigin } from "@/lib/site-url";

// The pages worth finding. Manage pages are personal and stay out.
const PATHS = ["/", "/book", "/privacy", "/terms"];

// R160: every page once per language the salon publishes in, each pointing at
// its translations.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const salon = await getCachedTenant(headers().get("host") ?? "").catch(() => null);
  if (!salon) {
    return [];
  }

  const defaultLocale = defaultLocaleOf(salon.configJson.enabledLocales);
  const enabled = (salon.configJson.enabledLocales ?? []).filter(isLocale);
  const locales = enabled.length > 0 ? enabled : [defaultLocale];
  const url = (locale: string, path: string) => `${origin}${localePath(locale, defaultLocale, path)}`;

  return PATHS.flatMap((path) =>
    locales.map((locale) => ({
      url: url(locale, path),
      changeFrequency: path === "/" || path === "/book" ? ("daily" as const) : ("yearly" as const),
      priority: path === "/" ? 1 : path === "/book" ? 0.8 : 0.3,
      alternates: { languages: Object.fromEntries(locales.map((other) => [other, url(other, path)])) },
    })),
  );
}
