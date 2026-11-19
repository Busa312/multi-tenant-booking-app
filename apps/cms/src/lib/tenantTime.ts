import { DATE_NAMES, georgianDate, type CalendarDate } from "@booking/shared-types";
// Every time the CMS shows or collects is the *salon's* wall clock, not the
// staff browser's: an owner checking tomorrow's book from another timezone must
// still see the day their customers will walk in on. So all formatting here
// takes the tenant's IANA timezone explicitly, and the API is handed wall-clock
// date + time strings rather than instants (see CreateCmsAppointmentRequest).

const partsIn = (instant: Date, timeZone: string): Record<string, string> => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

/** Tenant-local calendar date ("YYYY-MM-DD") of an instant — "today" by default. */
export function tenantDateString(timeZone: string, instant: Date = new Date()): string {
  const p = partsIn(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Tenant-local "HH:mm" of an instant — the form value that round-trips to the API. */
export function tenantTimeString(iso: string, timeZone: string): string {
  const p = partsIn(new Date(iso), timeZone);
  return `${p.hour}:${p.minute}`;
}

/**
 * A bare "YYYY-MM-DD" as a Date at UTC midnight. Everything below formats it
 * with `timeZone: "UTC"` to match: a calendar date is not an instant, and
 * reading it in any other zone can slide it to the neighbouring day.
 */
const dateOf = (date: string): Date => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
};

/** Shifts a "YYYY-MM-DD" by whole days, staying in calendar space. */
export function addDays(date: string, days: number): string {
  return new Date(dateOf(date).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** The Monday of the week a "YYYY-MM-DD" falls in. */
export function startOfWeek(date: string): string {
  // Monday-based: that's how a salon reads its week, and `getUTCDay` counts from
  // Sunday, so shift before taking the offset.
  const daysSinceMonday = (dateOf(date).getUTCDay() + 6) % 7;
  return addDays(date, -daysSinceMonday);
}

/** The first day of the month a "YYYY-MM-DD" falls in. */
export function startOfMonth(date: string): string {
  return `${date.slice(0, 8)}01`;
}

/** Shifts a "YYYY-MM-DD" by whole months; the 31st lands on a shorter month's last day. */
export function addMonths(date: string, months: number): string {
  const from = dateOf(date);
  const first = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(from.getUTCDate(), lastDay));
  return first.toISOString().slice(0, 10);
}

/*
 * Georgian dates come from the shared tables (@booking/shared-types dates.ts)
 * rather than Intl: Chromium has no Georgian data and would print English
 * month and weekday names in a Georgian CMS. English goes through Intl.
 */
const calendarOf = (date: string): CalendarDate => {
  const d = dateOf(date);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay() };
};
/** An instant's calendar date on the salon's clock. */
const calendarAt = (iso: string, timeZone: string): CalendarDate => calendarOf(tenantDateString(timeZone, new Date(iso)));

/**
 * R570: Russian `Intl` writes month and weekday names in lower case
 * ("суббота, 21 ноября"), as mid-sentence; these labels start a heading or a
 * column, so their first letter is raised.
 */
const asLabel = (text: string, lang: string): string => (lang === "ru" ? text.charAt(0).toLocaleUpperCase("ru") + text.slice(1) : text);

/**
 * R570: Russian `Intl` ends a date with a year in "г." ("3 декабря 2026 г."),
 * which doubles the full stop when the date ends a sentence. Plain
 * "3 декабря 2026" reads just as well, so the "г." goes.
 */
const withoutYearMark = (text: string, lang: string): string => (lang === "ru" ? text.replace(/\s*г\.$/, "") : text);

/** The month of a "YYYY-MM-DD", e.g. "November 2026". */
export function formatMonthLabel(date: string, lang: string): string {
  if (lang === "ka") return georgianDate.month(calendarOf(date));
  return asLabel(withoutYearMark(new Intl.DateTimeFormat(lang, { month: "long", year: "numeric", timeZone: "UTC" }).format(dateOf(date)), lang), lang);
}

/** A "YYYY-MM-DD" rendered for humans in the active UI language. */
export function formatDateLabel(date: string, lang: string): string {
  if (lang === "ka") return georgianDate.long(calendarOf(date));
  return asLabel(
    new Intl.DateTimeFormat(lang, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(dateOf(date)),
    lang,
  );
}

/** An inclusive span of calendar dates, e.g. "3 – 9 August". */
export function formatWeekLabel(from: string, to: string, lang: string): string {
  if (lang === "ka") return georgianDate.range(calendarOf(from), calendarOf(to));
  const formatter = new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", timeZone: "UTC" });
  return formatter.formatRange(dateOf(from), dateOf(to));
}

/** Short weekday name for a calendar date, e.g. "Mon". */
export function formatWeekdayLabel(date: string, lang: string): string {
  if (lang === "ka") return DATE_NAMES.ka.weekdaysShort[calendarOf(date).weekday] ?? "";
  return asLabel(new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(dateOf(date)), lang);
}

/** Day-of-month for a calendar date, for a compact column header. */
export function dayOfMonth(date: string): number {
  return dateOf(date).getUTCDate();
}

/** How far `timeZone` is ahead of UTC at a given instant, in milliseconds. */
function offsetAt(instant: Date, timeZone: string): number {
  const p = partsIn(instant, timeZone);
  const asIfUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    instant.getUTCSeconds(),
  );
  return asIfUtc - instant.getTime();
}

/**
 * A wall-clock "YYYY-MM-DDTHH:mm" *in the tenant's timezone* as a real instant.
 *
 * `new Date(value)` would read it in the staff browser's zone, so an owner in
 * London blocking "09:00" for a Tbilisi salon would store 13:00 salon time. Two
 * passes because the offset itself depends on the instant: the first guess
 * lands close enough to read the correct offset, which the second applies (the
 * same technique as the API's `zonedTimeToUtc`).
 */
export function tenantWallTimeToUtc(localDateTime: string, timeZone: string): Date {
  const asUtc = Date.parse(`${localDateTime}:00Z`);
  if (Number.isNaN(asUtc)) {
    throw new RangeError(`not a YYYY-MM-DDTHH:mm value: ${localDateTime}`);
  }
  const firstGuess = new Date(asUtc - offsetAt(new Date(asUtc), timeZone));
  return new Date(asUtc - offsetAt(firstGuess, timeZone));
}

/**
 * Georgian reads the 24-hour clock. Browsers without Georgian locale data
 * (Chromium) fall back to English and would show "10:00 AM" in a Georgian UI,
 * so the clock is set explicitly rather than left to the locale.
 */
const hourCycleFor = (lang: string): { hourCycle?: "h23" } => (lang === "ka" ? { hourCycle: "h23" } : {});

/** An instant as a tenant-local clock time, in the active UI language. */
export function formatTimeLabel(iso: string, timeZone: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { timeZone, hour: "2-digit", minute: "2-digit", ...hourCycleFor(lang) }).format(new Date(iso));
}

/** An instant as a tenant-local date + time, for conflicts that fall elsewhere. */
export function formatDateTimeLabel(iso: string, timeZone: string, lang: string): string {
  if (lang === "ka") {
    const d = calendarAt(iso, timeZone);
    return `${d.day} ${DATE_NAMES.ka.monthsShort[d.month]}, ${formatTimeLabel(iso, timeZone, lang)}`;
  }
  return new Intl.DateTimeFormat(lang, {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...hourCycleFor(lang),
  }).format(new Date(iso));
}

/** An instant as a tenant-local calendar date with the year, e.g. "22 December 2026" (R470: billing dates). */
export function formatInstantDate(iso: string, timeZone: string, lang: string): string {
  if (lang === "ka") return georgianDate.withYear(calendarAt(iso, timeZone));
  return withoutYearMark(new Intl.DateTimeFormat(lang, { timeZone, day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)), lang);
}

/** An instant as a short date on the viewer's own calendar, e.g. "18 Nov 2026" / "18 ნოე. 2026" — for record dates, not appointments. */
export function formatShortDate(iso: string, lang: string): string {
  const d = new Date(iso);
  if (lang === "ka") {
    return georgianDate.short({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), weekday: d.getDay() });
  }
  return withoutYearMark(new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(d), lang);
}
