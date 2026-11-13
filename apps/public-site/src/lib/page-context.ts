import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApiError } from "@booking/api-client";
import { defaultLocaleOf, localized } from "@booking/shared-types";
import type { Tenant } from "@booking/shared-types";
import { getCachedTenant } from "./tenant-config";
import { getMessages, isLocale, resolveLocale, translator, type Locale, type Translate } from "@/i18n/locales";
import { SITE_PATH_HEADER, localePath } from "./locale-path";

export interface PageContext {
  tenant: Tenant;

  locale: Locale;

  defaultLocale: string;

  t: Translate;

  text: (plain: string, i18n: unknown) => string;

  /** R160: a site path ("/book") as a link in the language being read. */
  href: (path: string) => string;
}

/**
 * The page's salon and language. A host no salon owns (a mistyped or deleted
 * subdomain) ends the render with notFound(), so it answers 404 rather than
 * crashing into a 500, which search engines and uptime checks read as an
 * outage. The root layout uses loadPageContextOrNull instead and draws the
 * not-found page itself: it is the outermost layout, so nothing above it
 * could.
 */
// R160: each page has exactly one URL per language. A language prefix the salon
// doesn't publish in, or one naming its main language (whose pages have no
// prefix), is redirected to the unprefixed page rather than served as a duplicate.
export async function loadPageContext(requestedLocale: string): Promise<PageContext> {
  const context = await loadPageContextOrNull(requestedLocale);
  if (!context) {
    notFound();
  }
  if (isLocale(requestedLocale) && (requestedLocale !== context.locale || requestedLocale === context.defaultLocale)) {
    redirect(headers().get(SITE_PATH_HEADER) ?? "/");
  }
  return context;
}

/** As loadPageContext, but null for a host no salon owns. */
export async function loadPageContextOrNull(requestedLocale: string): Promise<PageContext | null> {
  const host = headers().get("host") ?? "";
  const tenant = await loadTenant(host);
  if (!tenant) {
    return null;
  }

  const locale = resolveLocale(requestedLocale, tenant.configJson.enabledLocales);
  const defaultLocale = defaultLocaleOf(tenant.configJson.enabledLocales);

  return {
    tenant,
    locale,
    defaultLocale,
    t: translator(getMessages(locale)),
    text: (plain, i18n) => localized(plain, i18n, locale, defaultLocale),
    href: (path) => localePath(locale, defaultLocale, path),
  };
}

// Only the API's 404 means "no such salon"; any other failure still throws to
// the error boundary.
async function loadTenant(host: string): Promise<Tenant | null> {
  try {
    return await getCachedTenant(host);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export function resolveCopy(context: PageContext): { title: string; description: string } {
  const copy = context.tenant.configJson.copy ?? {};
  const name = context.tenant.name;

  const title = copy.title ? context.text(copy.title, copy.titleI18n) : context.t("home.defaultTitle", { name });
  const description = copy.description
    ? context.text(copy.description, copy.descriptionI18n)
    : context.t("home.defaultDescription", { name });

  return { title, description };
}
