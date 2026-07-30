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

/** A "YYYY-MM-DD" rendered for humans in the active UI language. */
export function formatDateLabel(date: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(dateOf(date));
}

/** An inclusive span of calendar dates, e.g. "3 – 9 August". */
export function formatWeekLabel(from: string, to: string, lang: string): string {
  const formatter = new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", timeZone: "UTC" });
  return formatter.formatRange(dateOf(from), dateOf(to));
}

/** Short weekday name for a calendar date, e.g. "Mon". */
export function formatWeekdayLabel(date: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(dateOf(date));
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

/** An instant as a tenant-local clock time, in the active UI language. */
export function formatTimeLabel(iso: string, timeZone: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** An instant as a tenant-local date + time, for conflicts that fall elsewhere. */
export function formatDateTimeLabel(iso: string, timeZone: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
