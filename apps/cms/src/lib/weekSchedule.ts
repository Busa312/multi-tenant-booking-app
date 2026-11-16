import type { BusinessHours } from "@booking/shared-types";

/**
 * The working copy of a week's business hours, and the diff that turns it back
 * into API calls.
 *
 * The Hours page used to write to the server on every interaction — a checkbox,
 * a blurred time input, each of the seven days a copy-to-all touched — and
 * refetch all four of its endpoints after each one. This module is what lets it
 * hold an edit instead: React-free like `dashboardStats.ts`, because deciding
 * what changed is the part that must be right, and it is easier to check when
 * it is separable from the form that produced it.
 */

/** A working window, "HH:MM" on the salon's clock. */
export interface DayWindow {
  startTime: string;
  endTime: string;
}

/**
 * One day in the scope being edited. `null` means the day has no row of its
 * own — closed at organisation scope, inherited from the organisation at
 * professional scope. That absence is meaningful to the availability engine
 * (`workingWindows`), so it is modelled rather than flattened.
 *
 * R460: `"off"` is a professional's day off — a row of their own, so nothing is
 * inherited, with no window. Never used at organisation scope.
 */
export type DayHours = DayWindow | "off" | null;

/** The day's own window, if it has one (not inherited, not off). */
export function windowOf(day: DayHours): DayWindow | null {
  return day !== null && day !== "off" ? day : null;
}

/** The week, keyed by `dayOfWeek` the way the API stores it (Sunday = 0). */
export type WeekDraft = Record<number, DayHours>;

export const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** noUncheckedIndexedAccess makes every `Record<number, …>` read optional. */
export function dayOf(draft: WeekDraft, dayOfWeek: number): DayHours {
  return draft[dayOfWeek] ?? null;
}

/** Seeds a draft from what's stored, for one scope. */
export function draftFromHours(hours: readonly BusinessHours[], professionalId: string | null): WeekDraft {
  const draft: WeekDraft = {};
  for (const dayOfWeek of WEEK_DAYS) {
    draft[dayOfWeek] = null;
  }
  for (const row of hours) {
    if (row.professionalId === professionalId) {
      draft[row.dayOfWeek] = row.isDayOff ? "off" : { startTime: row.startTime, endTime: row.endTime };
    }
  }
  return draft;
}

/**
 * Both ends present, and the end after the start.
 *
 * Times are zero-padded "HH:MM", so lexicographic comparison is chronological —
 * the same assumption `ScheduleDayRow` has always made. An empty string is a
 * half-finished `<input type="time">`, which must block the save rather than
 * being sent as a window starting at midnight.
 */
export function isValidWindow(day: DayHours): boolean {
  const window = windowOf(day);
  if (window === null) return true;
  if (window.startTime === "" || window.endTime === "") return false;
  return window.endTime > window.startTime;
}

/** Days that can't be saved, so the form can point at them and block submit. */
export function invalidDays(draft: WeekDraft): number[] {
  return WEEK_DAYS.filter((dayOfWeek) => !isValidWindow(dayOf(draft, dayOfWeek)));
}

export interface WeekChanges {
  upserts: { dayOfWeek: number; startTime: string; endTime: string; isDayOff?: boolean }[];
  /** Full rows, because the delete endpoint takes a row id rather than a day. */
  deletes: BusinessHours[];
}

/**
 * What has to be sent to make the server match the draft.
 *
 * Only genuinely changed days appear: re-saving a week where one time moved is
 * one call, not seven. Days that are `null` on both sides produce nothing at
 * all, which is why an untouched professional schedule — seven inherited days —
 * submits empty rather than writing seven redundant rows.
 */
export function diffWeek(
  draft: WeekDraft,
  hours: readonly BusinessHours[],
  professionalId: string | null,
): WeekChanges {
  const stored = hours.filter((row) => row.professionalId === professionalId);
  const changes: WeekChanges = { upserts: [], deletes: [] };

  for (const dayOfWeek of WEEK_DAYS) {
    const next = dayOf(draft, dayOfWeek);
    const current = stored.find((row) => row.dayOfWeek === dayOfWeek) ?? null;

    if (next === null) {
      if (current !== null) changes.deletes.push(current);
      continue;
    }
    if (next === "off") {
      // R460: the API stores the times as 00:00 whatever is sent.
      if (current === null || !current.isDayOff) {
        changes.upserts.push({ dayOfWeek, startTime: "00:00", endTime: "00:00", isDayOff: true });
      }
      continue;
    }
    if (current === null || current.isDayOff || current.startTime !== next.startTime || current.endTime !== next.endTime) {
      changes.upserts.push({ dayOfWeek, startTime: next.startTime, endTime: next.endTime });
    }
  }

  return changes;
}

export function hasChanges(changes: WeekChanges): boolean {
  return changes.upserts.length > 0 || changes.deletes.length > 0;
}
