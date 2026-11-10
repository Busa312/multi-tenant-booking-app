import { DATE_NAMES } from "@/i18n/dates";
import { isLocale } from "@/i18n/locales";

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function dateStringInTimezone(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function todayInTimezone(timezone: string): string {
  return dateStringInTimezone(new Date(), timezone);
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const at = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12));
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/**
 * "HH:mm" on the salon's clock, 00–23. `hourCycle: "h23"` rather than
 * `hour12: false`, which some engines read as h24 and print midnight as 24:05.
 * Also the wire format the API takes for a booking's time.
 */
export function wallClock(isoInstant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoInstant));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

// Times are 24-hour in every site locale, so no names are involved.
export function formatTime(isoInstant: string, timezone: string, _locale: string): string {
  return wallClock(isoInstant, timezone);
}

/** A calendar date ("2026-11-11") in the visitor's language, from our own name tables. */
export function formatDay(date: string, _timezone: string, locale: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const at = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  const names = DATE_NAMES[isLocale(locale) ? locale : "en"];
  return names.day({
    weekday: names.weekdaysShort[at.getUTCDay()] ?? "",
    day: at.getUTCDate(),
    month: names.monthsShort[at.getUTCMonth()] ?? "",
  });
}

/** An instant as the salon's local day and time: "Wed, Nov 11, 11:15" / "ოთხ, 11 ნოე, 11:15". */
export function formatInstant(isoInstant: string, timezone: string, locale: string): string {
  const date = dateStringInTimezone(new Date(isoInstant), timezone);
  return `${formatDay(date, timezone, locale)}, ${wallClock(isoInstant, timezone)}`;
}
