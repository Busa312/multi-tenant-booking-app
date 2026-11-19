import { en } from "./en";
import { ka } from "./ka";
import { ru } from "./ru";
import { defaultLocale, type Locale, type Messages } from "./types";

export { defaultLocale, locales, type Locale, type Messages } from "./types";

const catalogs: Record<Locale, Messages> = { ka, en, ru };

export const messagesFor = (locale: Locale): Messages => catalogs[locale];

/** The default language lives at the root; every other one under its own prefix. */
export const localeHome = (locale: Locale): string => (locale === defaultLocale ? "/" : `/${locale}/`);

/** R580: the contact page every "Get started" leads to, in that language. */
export const contactPath = (locale: Locale): string => `${localeHome(locale)}contact/`;

/** Each language in its own script, the same on every page. */
export const languageNames: Record<Locale, string> = { ka: "ქართული", en: "English", ru: "Русский" };
