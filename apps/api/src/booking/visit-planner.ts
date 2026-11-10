/**
 * R200/R220: plans a visit — an ordered chain of segments, each performed by
 * one professional — against everyone's open hours and existing commitments.
 *
 * Pure on purpose: no database, no clock, no timezone. AvailabilityService
 * loads the day into `PlannerInput` and this decides, so the rules can be
 * unit-tested exhaustively without stubbing Prisma.
 *
 * Rules:
 * - Units are performed in the given order (the customer's chosen order).
 * - The first unit starts exactly at the requested start.
 * - Each later unit starts 0..maxGapMinutes after the previous one ends,
 *   smallest gap first.
 * - A unit needs a candidate who has one open window containing the whole unit
 *   and nothing busy overlapping it, and the unit can't start before `notBefore`.
 * - The previous unit's professional is tried first, so a booking one person
 *   can do stays with one person (and becomes one appointment).
 *
 * Search cost stays small: with ≤5 units, a handful of candidates and ≤13 gap
 * steps, and failures memoized per (unit, earliest start, previous
 * professional), each start time is a few hundred cheap interval checks.
 */

export interface Interval {
  /** Epoch milliseconds. */
  start: number;
  end: number;
}

export interface ProfessionalSchedule {
  /** Open hours for the day, each a contiguous window. */
  windows: Interval[];
  /** Time off and existing appointments. */
  busy: Interval[];
}

export interface PlannerUnit {
  durationMinutes: number;
  /** Professionals allowed to perform this unit, in preference order. */
  candidates: string[];
}

export interface PlannerInput {
  units: PlannerUnit[];
  schedules: ReadonlyMap<string, ProfessionalSchedule>;
  maxGapMinutes: number;
  gapStepMinutes: number;
  /** Nothing may start before this instant (i.e. "now"). */
  notBefore: number;
}

export interface PlannedUnit {
  unitIndex: number;
  professionalId: string;
  start: number;
  end: number;
}

export interface PlannedVisit {
  start: number;
  end: number;
  units: PlannedUnit[];
}

const MINUTE = 60_000;

function fits(schedule: ProfessionalSchedule | undefined, start: number, end: number): boolean {
  if (!schedule) return false;
  const inWindow = schedule.windows.some((window) => window.start <= start && end <= window.end);
  return inWindow && !schedule.busy.some((busy) => start < busy.end && busy.start < end);
}

/**
 * The plan for a visit starting exactly at `start`, or null if none exists.
 * Pass a shared `memo` when planning many starts over the same input: which
 * suffixes are infeasible doesn't depend on the start.
 */
export function planVisitAt(input: PlannerInput, start: number, memo = new Set<string>()): PlannedVisit | null {
  if (input.units.length === 0 || start < input.notBefore) return null;
  const gapSteps = Math.floor(Math.max(0, input.maxGapMinutes) / Math.max(1, input.gapStepMinutes));

  const search = (index: number, earliest: number, previous: string | null, allowGap: boolean): PlannedUnit[] | null => {
    const unit = input.units[index];
    if (!unit) return [];

    const key = `${index}|${earliest}|${previous ?? ""}|${allowGap ? 1 : 0}`;
    if (memo.has(key)) return null;

    const ordered =
      previous !== null && unit.candidates.includes(previous)
        ? [previous, ...unit.candidates.filter((id) => id !== previous)]
        : unit.candidates;

    for (let step = 0; step <= (allowGap ? gapSteps : 0); step++) {
      const unitStart = earliest + step * input.gapStepMinutes * MINUTE;
      const unitEnd = unitStart + unit.durationMinutes * MINUTE;
      if (unitStart < input.notBefore) continue;

      for (const professionalId of ordered) {
        if (!fits(input.schedules.get(professionalId), unitStart, unitEnd)) continue;
        const rest = search(index + 1, unitEnd, professionalId, true);
        if (rest) return [{ unitIndex: index, professionalId, start: unitStart, end: unitEnd }, ...rest];
      }
    }

    memo.add(key);
    return null;
  };

  const units = search(0, start, null, false);
  const last = units?.[units.length - 1];
  return units && last ? { start, end: last.end, units } : null;
}

/** Every start in `starts` that has a plan, with that plan. */
export function planVisits(input: PlannerInput, starts: readonly number[]): PlannedVisit[] {
  const memo = new Set<string>();
  const plans: PlannedVisit[] = [];
  for (const start of starts) {
    const plan = planVisitAt(input, start, memo);
    if (plan) plans.push(plan);
  }
  return plans;
}

export interface PlannedGroup {
  professionalId: string;
  /** Indexes into the planner's units, in order. */
  unitIndexes: number[];
  start: number;
  end: number;
}

/**
 * R200: consecutive units by the same professional with no gap between them
 * become one appointment. A professional who appears again later, or after a
 * gap, gets a separate appointment.
 */
export function groupPlannedUnits(units: readonly PlannedUnit[]): PlannedGroup[] {
  const groups: PlannedGroup[] = [];
  for (const unit of units) {
    const last = groups[groups.length - 1];
    if (last && last.professionalId === unit.professionalId && last.end === unit.start) {
      last.unitIndexes.push(unit.unitIndex);
      last.end = unit.end;
    } else {
      groups.push({ professionalId: unit.professionalId, unitIndexes: [unit.unitIndex], start: unit.start, end: unit.end });
    }
  }
  return groups;
}
