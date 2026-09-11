

export type LocalizedText = Record<string, string>;

export function localized(
  plain: string,
  i18n: unknown,
  locale: string,
  defaultLocale: string,
): string {
  if (locale === defaultLocale) {
    return plain;
  }
  if (!i18n || typeof i18n !== "object" || Array.isArray(i18n)) {
    return plain;
  }
  const value = (i18n as Record<string, unknown>)[locale];

  return typeof value === "string" && value.trim() !== "" ? value : plain;
}

export const DEFAULT_CONTENT_LOCALE = "en";

/**
 * Every locale the platform can publish in, and the default set a tenant gets
 * until an owner narrows it on the Public site text page.
 *
 * The FIRST entry of a tenant's list is its default locale — the one the plain
 * columns hold — which is why order is meaningful here and not just a set.
 */
export const SUPPORTED_CONTENT_LOCALES = ["en", "ka"] as const;
export const DEFAULT_ENABLED_LOCALES: string[] = [...SUPPORTED_CONTENT_LOCALES];

/** A tenant's configured locales, falling back to the platform default. */
export function enabledLocalesOf(enabledLocales: string[] | undefined): string[] {
  const valid = (enabledLocales ?? []).filter((locale) => SUPPORTED_CONTENT_LOCALES.includes(locale as never));
  return valid.length > 0 ? valid : DEFAULT_ENABLED_LOCALES;
}

export function defaultLocaleOf(enabledLocales: string[] | undefined): string {
  return enabledLocalesOf(enabledLocales)[0] ?? DEFAULT_CONTENT_LOCALE;
}

