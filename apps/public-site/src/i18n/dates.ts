// Day and month names for the site's locales, from CLDR (what Node's full ICU
// prints for each locale), plus the order each language writes a date in.
//
// Kept here rather than left to `Intl` because browsers don't all ship every
// locale's data — Chromium has no Georgian, so `Intl.DateTimeFormat("ka")`
// silently prints English in client components, and differently from what the
// server rendered. With these tables server and browser print the same thing.

import type { Locale } from "./locales";

export interface DateParts {
  weekday: string;
  day: number;
  month: string;
}

interface DateNames {
  /** Sunday first, as `Date.getUTCDay()` counts. */
  weekdaysShort: readonly string[];
  monthsShort: readonly string[];
  /** A day: "Wed, Nov 11" / "ოთხ, 11 ნოე". */
  day: (parts: DateParts) => string;
}

export const DATE_NAMES: Record<Locale, DateNames> = {
  en: {
    weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    day: ({ weekday, day, month }) => `${weekday}, ${month} ${day}`,
  },
  ka: {
    weekdaysShort: ["კვი", "ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"],
    monthsShort: ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"],
    day: ({ weekday, day, month }) => `${weekday}, ${day} ${month}`,
  },
};
