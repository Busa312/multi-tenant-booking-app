import type { AppointmentStatus, DashboardDay, DashboardPeriod } from "@booking/shared-types";
import { Prisma } from "../../generated/prisma/index.js";
import { serializeMoney } from "../common/serializers.js";
import { zonedTimeToUtc } from "../common/timezone.js";
import { workingWindows, type BusinessHoursRow } from "../booking/working-hours.js";

/**
 * R370: the arithmetic behind the CMS home page, free of Prisma queries and
 * Nest so each rule can be pinned by a unit test. DashboardService fetches the
 * rows; everything that decides what a number means lives here.
 */

const MINUTE_MS = 60_000;

export interface Interval {
  start: Date;
  end: Date;
}

/** Milliseconds of `window` that none of `blocks` covers. */
export function uncoveredMs(window: Interval, blocks: readonly Interval[]): number {
  const from = window.start.getTime();
  const to = window.end.getTime();
  if (to <= from) return 0;

  const clipped = blocks
    .map((block) => ({ start: Math.max(from, block.start.getTime()), end: Math.min(to, block.end.getTime()) }))
    .filter((block) => block.end > block.start)
    .sort((a, b) => a.start - b.start);

  let covered = 0;
  let reach = from;
  for (const block of clipped) {
    if (block.end <= reach) continue;
    covered += block.end - Math.max(block.start, reach);
    reach = block.end;
  }
  return to - from - covered;
}

// ------------------------------------------------------------ week ahead

export interface WeekAppointmentRow {
  id: string;
  visitId: string | null;
  professionalId: string | null;
  startAt: Date;
  endAt: Date;
}

export interface TimeOffRow {
  /** null = the whole business is closed. */
  professionalId: string | null;
  startAt: Date;
  endAt: Date;
}

export interface DayInput {
  /** Tenant-local "YYYY-MM-DD". */
  date: string;
  timezone: string;
  /** Non-cancelled appointments starting on `date`, already narrowed to the scope. */
  appointments: readonly WeekAppointmentRow[];
  /** The professionals whose hours count: one for a professional login, else the active ones (at the branch). */
  professionalIds: readonly string[];
  /** Business hours rows for `date`'s weekday. */
  businessHours: readonly BusinessHoursRow[];
  /** Time off overlapping `date`. */
  timeOff: readonly TimeOffRow[];
}

/**
 * One day's bookings and occupancy. Working minutes use the same windows as
 * availability (`workingWindows`), minus the professional's own and the
 * business-wide time off. Booked minutes count only appointments assigned to a
 * professional in scope, so the ratio compares like with like; an unassigned
 * staff booking still counts as a booking.
 */
export function summarizeDay(input: DayInput): DashboardDay {
  const inScope = new Set(input.professionalIds);

  const bookings = new Set(input.appointments.map((row) => row.visitId ?? row.id)).size;
  const bookedMs = input.appointments
    .filter((row) => row.professionalId !== null && inScope.has(row.professionalId))
    .reduce((sum, row) => sum + Math.max(0, row.endAt.getTime() - row.startAt.getTime()), 0);

  let workingMs = 0;
  for (const professionalId of input.professionalIds) {
    const blocks = input.timeOff
      .filter((block) => block.professionalId === null || block.professionalId === professionalId)
      .map((block) => ({ start: block.startAt, end: block.endAt }));
    for (const window of workingWindows(input.businessHours, professionalId)) {
      const start = zonedTimeToUtc(input.date, window.startMinutes, input.timezone);
      const end = zonedTimeToUtc(input.date, window.endMinutes, input.timezone);
      workingMs += uncoveredMs({ start, end }, blocks);
    }
  }

  return {
    date: input.date,
    bookings,
    bookedMinutes: Math.round(bookedMs / MINUTE_MS),
    workingMinutes: Math.round(workingMs / MINUTE_MS),
  };
}

// ---------------------------------------------------------------- periods

export interface PeriodAppointmentRow {
  id: string;
  visitId: string | null;
  /** Who the client is: their number in its canonical spelling. */
  phoneKey: string;
  status: AppointmentStatus;
  createdByUserId: string | null;
  price: Prisma.Decimal;
}

/**
 * One rolling period. `firstSeen` maps each phone to its first non-cancelled
 * appointment ever (in the same scope); a client whose first visit falls on or
 * after `periodStart` is new, everyone else is returning. Cancelled rows count
 * towards the cancellation rate only: a cancelled booking was never a visit
 * and makes nobody a client.
 */
export function summarizePeriod(
  rows: readonly PeriodAppointmentRow[],
  firstSeen: ReadonlyMap<string, Date>,
  periodStart: Date,
  includeValue: boolean,
): DashboardPeriod {
  const kept = rows.filter((row) => row.status !== "cancelled");

  const visits = new Set<string>();
  const onlineVisits = new Set<string>();
  const phones = new Set<string>();
  for (const row of kept) {
    const visit = row.visitId ?? row.id;
    visits.add(visit);
    // A visit is online when the customer made it: no staff author.
    if (row.createdByUserId === null) onlineVisits.add(visit);
    phones.add(row.phoneKey);
  }

  let newClients = 0;
  for (const phone of phones) {
    const first = firstSeen.get(phone);
    if (!first || first.getTime() >= periodStart.getTime()) newClients += 1;
  }

  const completedRows = rows.filter((row) => row.status === "completed");
  const completedValue = includeValue
    ? serializeMoney(completedRows.reduce((sum, row) => sum.plus(row.price), new Prisma.Decimal(0)))
    : null;

  return {
    bookings: visits.size,
    onlineBookings: onlineVisits.size,
    appointments: rows.length,
    completed: completedRows.length,
    noShows: rows.filter((row) => row.status === "no_show").length,
    cancelled: rows.length - kept.length,
    newClients,
    returningClients: phones.size - newClients,
    completedValue,
  };
}
