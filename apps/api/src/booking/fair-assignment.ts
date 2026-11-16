/**
 * R450: who gets an "any professional" booking. The visit planner takes the
 * first free candidate in its list, so fairness is entirely in the order of
 * that list — this module decides it, from each professional's day.
 */

import type { Interval } from "./visit-planner.js";

export interface DayWorkload {
  /** Working time that day: their hours minus time off. */
  capacityMs: number;
  /** Time already taken that day: appointments and other customers' live holds. */
  bookedMs: number;
}

/** Overlapping or touching intervals merged, so nothing is counted twice. */
function merge(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals.filter((interval) => interval.end > interval.start).sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

function totalLength(intervals: readonly Interval[]): number {
  return intervals.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
}

/** How much of `intervals` falls inside `within`. */
function overlapLength(intervals: readonly Interval[], within: readonly Interval[]): number {
  let total = 0;
  for (const a of intervals) {
    for (const b of within) {
      total += Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
    }
  }
  return total;
}

/**
 * One professional's day, measured. Booked time counts wherever it falls in
 * the day — a booking staff put outside the hours is still work done — but is
 * clipped to the day itself, since the planner plans one day at a time.
 */
export function dayWorkload(input: {
  day: Interval;
  windows: readonly Interval[];
  timeOff: readonly Interval[];
  booked: readonly Interval[];
}): DayWorkload {
  const windows = merge(input.windows);
  const capacityMs = totalLength(windows) - overlapLength(windows, merge(input.timeOff));
  const clipped = input.booked.map((interval) => ({
    start: Math.max(interval.start, input.day.start),
    end: Math.min(interval.end, input.day.end),
  }));
  return { capacityMs: Math.max(0, capacityMs), bookedMs: totalLength(merge(clipped)) };
}

/** Booked share of the day; someone with no working time is never preferred. */
function share(load: DayWorkload | undefined): number {
  if (!load || load.capacityMs <= 0) return Number.POSITIVE_INFINITY;
  return load.bookedMs / load.capacityMs;
}

/**
 * A number that is stable for a professional on a given day but reshuffles
 * from day to day (32-bit FNV-1a of "date:id"), so a tie is never settled the
 * same way every day — and never by name.
 */
export function dailyRotation(date: string, professionalId: string): number {
  let hash = 0x811c9dc5;
  for (const char of `${date}:${professionalId}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

// Shares closer than this are a tie: 1e-9 of a day is far below a minute.
const EPSILON = 1e-9;

/**
 * R450: candidates in the order the planner should try them — lowest booked
 * share of their working day first, then fewest booked minutes, then the daily
 * rotation. Returns a new array; ids missing from `loads` go last.
 */
export function fairOrder(ids: readonly string[], loads: ReadonlyMap<string, DayWorkload>, date: string): string[] {
  return [...ids].sort((a, b) => {
    const shareA = share(loads.get(a));
    const shareB = share(loads.get(b));
    if (shareA !== shareB && !(Math.abs(shareA - shareB) < EPSILON)) return shareA - shareB;
    const bookedA = loads.get(a)?.bookedMs ?? Number.POSITIVE_INFINITY;
    const bookedB = loads.get(b)?.bookedMs ?? Number.POSITIVE_INFINITY;
    if (bookedA !== bookedB) return bookedA - bookedB;
    return dailyRotation(date, a) - dailyRotation(date, b);
  });
}
