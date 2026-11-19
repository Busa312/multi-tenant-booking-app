import en from "./messages/en.json";
import ka from "./messages/ka.json";
import ru from "./messages/ru.json";

/** R160's languages; Russian is R570 (opt-in per salon). */
export const LOCALES = ["en", "ka", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/**
 * R160: the URL segment that stands for "the salon's main language". A path
 * with no language prefix is rewritten to it by the middleware; which language
 * it means is resolved per salon (resolveLocale: anything that isn't an
 * enabled locale falls back to the salon's first).
 */
export const DEFAULT_LOCALE_SEGMENT = "_";

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type Messages = Widen<typeof en>;

const DICTS: Record<Locale, Messages> = { en, ka, ru };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getMessages(locale: Locale): Messages {
  return DICTS[locale];
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ka: "ქართული",
  ru: "Русский",
};

export function resolveLocale(requested: string, enabledLocales: string[] | undefined): Locale {
  const enabled = (enabledLocales ?? []).filter(isLocale);
  if (enabled.length === 0) {
    return isLocale(requested) ? requested : DEFAULT_LOCALE;
  }
  if (isLocale(requested) && enabled.includes(requested)) {
    return requested;
  }
  return enabled[0] ?? DEFAULT_LOCALE;
}

export function translator(messages: Messages) {
  return (key: string, vars?: Record<string, string | number>): string => {
    const value = key.split(".").reduce<unknown>((acc, part) => {
      return acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined;
    }, messages);
    const template = typeof value === "string" ? value : key;
    if (!vars) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
  };
}

export type Translate = ReturnType<typeof translator>;
