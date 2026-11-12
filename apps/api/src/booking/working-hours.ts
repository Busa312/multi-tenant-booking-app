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
