// Day and month names for the platform's languages, from CLDR (what Node's full
// ICU prints for each locale), plus the order each language writes a date in.
//
// Kept as tables rather than left to `Intl` because browsers don't all ship
// every locale's data — Chromium has no Georgian, so `Intl.DateTimeFormat("ka")`
// silently prints English. The booking site and the CMS both read these, so
// a date reads the same in both, and on the server and in the browser.

export type DateLang = "en" | "ka";

export interface DateParts {
  weekday: string;
  day: number;
  month: string;
}

export interface DateNames {
  /** Sunday first, as `Date.getUTCDay()` counts. */
  weekdaysShort: readonly string[];
  weekdays: readonly string[];
  monthsShort: readonly string[];
  months: readonly string[];
  /** A day: "Wed, Nov 11" / "ოთხ, 11 ნოე". */
  day: (parts: DateParts) => string;
}

export const DATE_NAMES: Record<DateLang, DateNames> = {
  en: {
    weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    day: ({ weekday, day, month }) => `${weekday}, ${month} ${day}`,
  },
  ka: {
    weekdaysShort: ["კვი", "ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"],
    weekdays: ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"],
    monthsShort: ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"],
    months: ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"],
    day: ({ weekday, day, month }) => `${weekday}, ${day} ${month}`,
  },
};

/** Calendar parts of a date, in the order a formatter needs them. */
export interface CalendarDate {
  year: number;
  /** 0 = January. */
  month: number;
  day: number;
  /** 0 = Sunday. */
  weekday: number;
}

/**
 * Georgian dates, in CLDR's patterns for `ka`, for where `Intl` can't be
 * trusted to have them. (English goes through `Intl`, which every browser has.)
 */
export const georgianDate = {
  /** "ნოემბერი, 2026" */
  month: (d: CalendarDate) => `${DATE_NAMES.ka.months[d.month]}, ${d.year}`,
  /** "ოთხშაბათი, 18 ნოემბერი" */
  long: (d: CalendarDate) => `${DATE_NAMES.ka.weekdays[d.weekday]}, ${d.day} ${DATE_NAMES.ka.months[d.month]}`,
  /** "18 ნოემბერი, 2026" */
  withYear: (d: CalendarDate) => `${d.day} ${DATE_NAMES.ka.months[d.month]}, ${d.year}`,
  /** "18 ნოე. 2026" */
  short: (d: CalendarDate) => `${d.day} ${DATE_NAMES.ka.monthsShort[d.month]}. ${d.year}`,
  /** "16–22 ნოემბერი", or across months "30 ნოემბერი – 6 დეკემბერი" */
  range: (from: CalendarDate, to: CalendarDate) =>
    from.month === to.month && from.year === to.year
      ? `${from.day}–${to.day} ${DATE_NAMES.ka.months[to.month]}`
      : `${from.day} ${DATE_NAMES.ka.months[from.month]} – ${to.day} ${DATE_NAMES.ka.months[to.month]}`,
};
