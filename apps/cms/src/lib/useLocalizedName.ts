import { useCallback, useEffect, useState } from "react";
import { defaultLocaleOf, localized } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { cachedApi } from "./cache.js";

/** Picks the name to show from a plain name and its translations. */
export type NameOf = (plain: string, i18n: unknown) => string;

/**
 * R160 in the CMS: service, professional and location names in the CMS's own
 * language, the same way the public site picks them — the plain column holds
 * the tenant's default locale, `*I18n` holds the others, and a missing
 * translation falls back to the plain name.
 *
 * The default locale comes from the tenant's settings (cached; the first render
 * uses whatever is already cached, else the platform default, which is what an
 * unconfigured tenant has anyway).
 */
export function useLocalizedName(): NameOf {
  const { lang } = useI18n();
  const [defaultLocale, setDefaultLocale] = useState(() =>
    defaultLocaleOf(cachedApi.peekTenant()?.configJson.enabledLocales),
  );

  useEffect(() => {
    let cancelled = false;
    cachedApi
      .getTenant()
      .then((tenant) => {
        if (!cancelled) setDefaultLocale(defaultLocaleOf(tenant.configJson.enabledLocales));
      })
      // Names just stay on the default-locale assumption.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return useCallback<NameOf>((plain, i18n) => localized(plain, i18n, lang, defaultLocale), [lang, defaultLocale]);
}
