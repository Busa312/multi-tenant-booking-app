/**
 * R610: when a booking's reminder goes out. Pure.
 *
 * `reminder_hours_before` before the start — but never at night: a reminder
 * due between 21:00 and 09:00 salon time goes out at 20:00 the evening
 * before, and nothing at all is sent between 21:00 and 09:00 (a retry waits
 * for the morning). Local times go through the zone, so DST is handled.
 */
import { addDaysToDateString, zonedDateString, zonedParts, zonedTimeToUtc } from "../common/timezone.js";

export const QUIET_FROM_HOUR = 21;
export const QUIET_UNTIL_HOUR = 9;
/** Where a reminder due in the quiet hours is moved to: 20:00 the evening before. */
export const EVENING_SEND_HOUR = 20;

export function inQuietHours(at: Date, timezone: string): boolean {
  const { hour } = zonedParts(at, timezone);
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

/** When the reminder for a visit starting at `startAt` is due; null when reminders are off. */
export function reminderDueAt(startAt: Date, hoursBefore: number, timezone: string): Date | null {
  if (hoursBefore <= 0) return null;
  const due = new Date(startAt.getTime() - hoursBefore * 3_600_000);
  const { hour } = zonedParts(due, timezone);
  const dueDate = zonedDateString(due, timezone);
  if (hour >= QUIET_FROM_HOUR) return zonedTimeToUtc(dueDate, EVENING_SEND_HOUR * 60, timezone);
  if (hour < QUIET_UNTIL_HOUR) return zonedTimeToUtc(addDaysToDateString(dueDate, -1), EVENING_SEND_HOUR * 60, timezone);
  return due;
}

/** How far ahead of now a booking can start and still be due: the longest setting plus the evening pull (≤ 13 h). */
export function reminderLookaheadMs(hoursBefore: number): number {
  return (hoursBefore + 14) * 3_600_000;
}

export interface ReminderCandidate {
  startAt: Date;
  /** When it was booked; a booking made after its reminder was due gets none. */
  createdAt: Date;
}

/**
 * - `send`: due now.
 * - `wait`: not yet, or it's night — check again later.
 * - `skip`: never — reminders are off, it already started, or it was booked
 *   after its reminder time (the customer just booked).
 */
export type ReminderVerdict = "send" | "wait" | "skip";

export function reminderVerdict(candidate: ReminderCandidate, hoursBefore: number, timezone: string, now: Date): ReminderVerdict {
  const due = reminderDueAt(candidate.startAt, hoursBefore, timezone);
  if (!due || candidate.startAt <= now || candidate.createdAt >= due) return "skip";
  if (now < due || inQuietHours(now, timezone)) return "wait";
  return "send";
}
