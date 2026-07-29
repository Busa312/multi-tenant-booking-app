/**
 * Tenant-timezone wall-clock <-> UTC instant conversion.
 *
 * Hours and slots are reasoned about in the tenant's local time
 * (`Tenant.timezone`, IANA) while everything stored is `timestamptz`, so every
 * availability computation crosses this boundary. Implemented on the platform's
 * own `Intl` (full ICU ships with Node >= 20) rather than adding a date library
 * for what amounts to two functions.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
}

/** The wall-clock reading a given instant produces in `timeZone`. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/** `timeZone`'s offset from UTC at `instant`, in ms (east of UTC is positive). */
function offsetMsAt(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // The formatter has second precision; drop sub-second noise from the input
  // so the difference is a clean offset rather than offset-minus-milliseconds.
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Parses "YYYY-MM-DD" into its calendar fields. Throws on anything else. */
export function parseDateOnly(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new RangeError(`Expected a YYYY-MM-DD date, got "${date}"`);
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Parses "HH:mm" (or "HH:mm:ss") into minutes from midnight. Throws otherwise. */
export function parseTimeOfDay(time: string): number {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time);
  if (!match?.[1] || !match[2]) {
    throw new RangeError(`Expected an HH:mm time, got "${time}"`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new RangeError(`Not a valid time of day: "${time}"`);
  }
  return hour * 60 + minute;
}

/**
 * The instant at which `timeZone`'s clock reads `date` + `minutesFromMidnight`.
 *
 * Resolved in two passes because the offset that applies is the one *at the
 * result*, not at the naive guess: on a DST boundary those differ, and a
 * single-pass conversion lands an hour off for the rest of that day. Clock
 * readings that DST skips (02:30 on a spring-forward day) have no exact
 * instant — the second pass maps them forward past the gap, which is the same
 * choice date-fns-tz and Temporal's "compatible" disambiguation make.
 */
export function zonedTimeToUtc(date: string, minutesFromMidnight: number, timeZone: string): Date {
  const { year, month, day } = parseDateOnly(date);
  const wallClock = Date.UTC(year, month - 1, day, 0, minutesFromMidnight);

  const firstPass = wallClock - offsetMsAt(new Date(wallClock), timeZone);
  const secondPass = wallClock - offsetMsAt(new Date(firstPass), timeZone);
  return new Date(secondPass);
}

/** The tenant-local calendar date ("YYYY-MM-DD") an instant falls on. */
export function zonedDateString(instant: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(instant, timeZone);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Shifts a "YYYY-MM-DD" date by whole days, staying in calendar space. */
export function addDaysToDateString(date: string, days: number): string {
  const { year, month, day } = parseDateOnly(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Day of week (0 = Sunday, matching `BusinessHours.day_of_week`) for a
 * tenant-local calendar date. Timezone-independent: the date string already
 * *is* the local day, so no instant is involved.
 */
export function dayOfWeekForDateString(date: string): number {
  const { year, month, day } = parseDateOnly(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
