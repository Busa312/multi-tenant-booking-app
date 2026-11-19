import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import enRaw from "./messages/en.json";
import kaRaw from "./messages/ka.json";
import ruRaw from "./messages/ru.json";

/** The CMS's languages; Russian is R570. Same as `CmsLang` in shared-types. */
export type Lang = "en" | "ka" | "ru";

// Widen JSON's inferred string-literal types to plain `string` so every locale
// is assignable to one shared Messages shape — which also makes a missing or
// misspelled key in ka.json a compile-time error (parity enforcement).
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type Messages = Widen<typeof enRaw>;

const en: Messages = enRaw;
const ka: Messages = kaRaw;
const ru: Messages = ruRaw;
const DICTS: Record<Lang, Messages> = { en, ka, ru };

// Language names are shown as endonyms (each in its own script), so they are the
// same regardless of the active language.
export const LOCALES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ka", label: "ქართული" },
  { code: "ru", label: "Русский" },
];

const STORAGE_KEY = "booking_cms_lang";

type Vars = Record<string, string | number>;

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Look up a dotted message key and interpolate `{placeholders}`. */
  t: (key: string, vars?: Vars) => string;
  /** The active locale's raw catalog, for non-string values (e.g. day-name arrays). */
  messages: Messages;
}

const I18nContext = createContext<I18nValue | null>(null);

function resolve(dict: Messages, key: string): string {
  const value = key.split(".").reduce<unknown>((acc, part) => {
    return acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined;
  }, dict);
  // Fall back to the key itself so a missing translation is visible, not blank.
  return typeof value === "string" ? value : key;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}

function detectInitial(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "ka" || stored === "ru") {
    return stored;
  }
  const browser = navigator.language.toLowerCase();
  return browser.startsWith("ka") ? "ka" : browser.startsWith("ru") ? "ru" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitial);

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
    setLangState(next);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[lang];
    return {
      lang,
      setLang,
      messages: dict,
      t: (key, vars) => interpolate(resolve(dict, key), vars),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
