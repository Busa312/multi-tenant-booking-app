/**
 * Which hours a professional works on a given weekday. Shared by availability
 * (what can be booked) and the R370 dashboard (how full the week is), so the
 * two can never disagree about when someone is at work.
 */

export interface WorkingWindow {
  /** Minutes from tenant-local midnight. */
  startMinutes: number;
  endMinutes: number;
}

export interface BusinessHoursRow {
  /** null = the tenant-wide default. */
  professionalId: string | null;
  /** A Postgres `time`, which Prisma hands over as a Date on 1970-01-01 UTC. */
  startTime: Date;
  endTime: Date;
}

export const timeToMinutes = (time: Date): number => time.getUTCHours() * 60 + time.getUTCMinutes();

/**
 * A professional's own rows when they have any, otherwise the tenant-wide
 * ones. `rows` must already be narrowed to one weekday. Empty or inverted
 * windows are dropped.
 */
export function workingWindows(rows: readonly BusinessHoursRow[], professionalId: string | null): WorkingWindow[] {
  const own = professionalId ? rows.filter((row) => row.professionalId === professionalId) : [];
  const chosen = own.length > 0 ? own : rows.filter((row) => row.professionalId === null);
  return chosen
    .map((row) => ({ startMinutes: timeToMinutes(row.startTime), endMinutes: timeToMinutes(row.endTime) }))
    .filter((window) => window.endMinutes > window.startMinutes);
}

const minutesToClock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export interface OpeningHoursDay {
  /** 0 = Sunday … 6 = Saturday, as `Date.getUTCDay()` counts. */
  dayOfWeek: number;
  /** "HH:mm" on the salon's clock. */
  opens: string;
  closes: string;
}

/**
 * R390: when the salon is open, for showing to visitors — one window per
 * weekday, closed days left out. The tenant-wide hours are the salon's opening
 * hours; a salon that set none (only per-professional hours) is open from its
 * first professional's start to its last one's finish. Several windows on one
 * day collapse to earliest start – latest end: this says when the door is
 * open, not when a given slot is free (availability does that).
 */
export function openingHours(
  rows: readonly (BusinessHoursRow & { dayOfWeek: number })[],
  activeProfessionalIds: readonly string[],
): OpeningHoursDay[] {
  const tenantWide = rows.filter((row) => row.professionalId === null);
  const source =
    tenantWide.length > 0
      ? tenantWide
      : rows.filter((row) => row.professionalId !== null && activeProfessionalIds.includes(row.professionalId));

  const days: OpeningHoursDay[] = [];
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    const windows = source
      .filter((row) => row.dayOfWeek === dayOfWeek)
      .map((row) => ({ start: timeToMinutes(row.startTime), end: timeToMinutes(row.endTime) }))
      .filter((window) => window.end > window.start);
    if (windows.length === 0) continue;
    days.push({
      dayOfWeek,
      opens: minutesToClock(Math.min(...windows.map((window) => window.start))),
      closes: minutesToClock(Math.max(...windows.map((window) => window.end))),
    });
  }
  return days;
}
