import { headers } from "next/headers";
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

export async function loadPageContext(requestedLocale: string): Promise<PageContext> {
  const host = headers().get("host") ?? "";
  const tenant = await getCachedTenant(host);

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

export function resolveCopy(context: PageContext): { title: string; description: string } {
  const copy = context.tenant.configJson.copy ?? {};
  const name = context.tenant.name;

  const title = copy.title ? context.text(copy.title, copy.titleI18n) : context.t("home.defaultTitle", { name });
  const description = copy.description
    ? context.text(copy.description, copy.descriptionI18n)
    : context.t("home.defaultDescription", { name });

  return { title, description };
}
