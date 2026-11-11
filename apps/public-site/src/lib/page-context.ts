import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ApiError } from "@booking/api-client";
import { defaultLocaleOf, localized } from "@booking/shared-types";
import type { Tenant } from "@booking/shared-types";
import { getCachedTenant } from "./tenant-config";
import { getMessages, resolveLocale, translator, type Locale, type Translate } from "@/i18n/locales";

export interface PageContext {
  tenant: Tenant;

  locale: Locale;

  defaultLocale: string;

  t: Translate;

  text: (plain: string, i18n: unknown) => string;
}

/**
 * The page's salon and language. A host no salon owns (a mistyped or deleted
 * subdomain) ends the render with notFound(), so it answers 404 rather than
 * crashing into a 500, which search engines and uptime checks read as an
 * outage. The root layout uses loadPageContextOrNull instead and draws the
 * not-found page itself: it is the outermost layout, so nothing above it
 * could.
 */
export async function loadPageContext(requestedLocale: string): Promise<PageContext> {
  const context = await loadPageContextOrNull(requestedLocale);
  if (!context) {
    notFound();
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
