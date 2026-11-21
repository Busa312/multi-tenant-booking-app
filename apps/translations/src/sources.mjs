// @ts-check
import { fileURLToPath } from "node:url";

/** The monorepo's root: every catalog path below is relative to it. */
export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** The platform's languages (R570), in the order the editor shows them. */
export const LOCALES = /** @type {const} */ (["en", "ka", "ru"]);

/** @typedef {(typeof LOCALES)[number]} Locale */

/**
 * Where one language of a catalog lives.
 *  - json: a whole JSON file of nested string values.
 *  - ts:   an exported object literal in a TypeScript file — the whole object
 *          (one file per language), or the property `key` of it (all the
 *          languages in one file).
 * @typedef {{ kind: "json"; file: string }
 *   | { kind: "ts"; file: string; exportName: string; key?: string }} LocaleFile
 */

/**
 * @typedef {object} Source
 * @property {string} id
 * @property {string} label
 * @property {string} hint  Where the text appears, for the editor's filter.
 * @property {Record<Locale, LocaleFile>} files
 * @property {string[]} [locked]  Paths that hold identifiers the code uses, not
 *   text (`*` matches any one key) — shown, never edited.
 */

/** @param {string} dir @returns {Record<Locale, LocaleFile>} */
const jsonPerLocale = (dir) => ({
  en: { kind: "json", file: `${dir}/en.json` },
  ka: { kind: "json", file: `${dir}/ka.json` },
  ru: { kind: "json", file: `${dir}/ru.json` },
});

/**
 * Every hand-written translation catalog in the monorepo. Left out on
 * purpose: the API's emails (their text is built in code around values, in
 * apps/api/src/notifications/mail-templates.ts) and the date names in
 * packages/shared-types/src/dates.ts (CLDR data, not copy).
 * @type {Source[]}
 */
export const SOURCES = [
  {
    id: "cms",
    label: "CMS",
    hint: "The salon workspace",
    files: jsonPerLocale("apps/cms/src/i18n/messages"),
  },
  {
    id: "booking",
    label: "Booking site",
    hint: "Every salon's booking site and its widget",
    files: jsonPerLocale("apps/public-site/src/i18n/messages"),
  },
  {
    id: "legal",
    label: "Booking site · legal",
    hint: "Privacy policy and terms (R340)",
    files: {
      en: { kind: "ts", file: "apps/public-site/src/i18n/legal.ts", exportName: "LEGAL", key: "en" },
      ka: { kind: "ts", file: "apps/public-site/src/i18n/legal.ts", exportName: "LEGAL", key: "ka" },
      ru: { kind: "ts", file: "apps/public-site/src/i18n/legal.ts", exportName: "LEGAL", key: "ru" },
    },
  },
  {
    id: "marketing",
    label: "Marketing site",
    hint: "The platform's own site (R560)",
    files: {
      en: { kind: "ts", file: "apps/marketing/src/i18n/en.ts", exportName: "en" },
      ka: { kind: "ts", file: "apps/marketing/src/i18n/ka.ts", exportName: "ka" },
      ru: { kind: "ts", file: "apps/marketing/src/i18n/ru.ts", exportName: "ru" },
    },
    locked: ["htmlLang", "ogLocale", "features.items.*.icon"],
  },
];
