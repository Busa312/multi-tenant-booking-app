import { BadRequestException, Injectable } from "@nestjs/common";
import type { AvailabilitySlot, BookingConflict, VisitSlot } from "@booking/shared-types";
import type { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { serializeLocalizedText } from "../common/serializers.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import {
  addDaysToDateString,
  dayOfWeekForDateString,
  parseDateOnly,
  zonedDateString,
  zonedTimeToUtc,
} from "../common/timezone.js";
import { resolveServiceLines, totalDurationMinutes, validateServiceIds } from "./service-lines.js";
import { VISIT_GAP_STEP_MINUTES } from "./booking-rules.js";
import { dayWorkload, fairOrder, type DayWorkload } from "./fair-assignment.js";
import { AvailabilityCacheService } from "./availability-cache.service.js";
import { workingWindows } from "./working-hours.js";
import {
  groupPlannedUnits,
  planVisitAt,
  planVisits,
  type PlannedVisit,
  type PlannerInput,
  type ProfessionalSchedule,
} from "./visit-planner.js";

export const SLOT_GRANULARITY_MINUTES = 15;

interface Instant {
  start: Date;
  end: Date;
}

interface Candidate {
  id: string | null;
  name: string | null;
}

export interface AvailabilityInput {
  serviceIds: string[];

  professionalId?: string | null;
  // R150: the branch being booked
  locationId?: string | null;

  date: string;

  excludeAppointmentId?: string;
}

export interface ConflictCheckInput {
  professionalId: string | null;
  startAt: Date;
  endAt: Date;

  excludeAppointmentId?: string;
}

/** R200: one link in a visit chain, before a professional is chosen for it. */
export interface VisitUnitSpec {
  durationMinutes: number;
  /** Every service whoever performs this unit must perform. */
  serviceIds: string[];
  /** A fixed professional, or null for any qualified one. */
  professionalId: string | null;
}

export interface VisitPlanInput {
  units: VisitUnitSpec[];
  // R150/R180: only professionals at this branch (or at every branch)
  locationId: string | null;
  date: string;
  // R80: a visit being moved doesn't block itself
  excludeVisitId?: string;
  // R250: the customer's own hold doesn't block their own booking
  excludeHoldId?: string | null;
  /**
   * Moving an existing visit: its fixed professionals may stay even if they've
   * since been deactivated, moved branch or stopped offering the service — the
   * same allowance BookingService makes for an appointment already on their
   * calendar (R120).
   */
  keepExistingPairings?: boolean;
}

export interface VisitSlotQuery {
  serviceIds: string[];
  /** Aligned with serviceIds; null = any qualified professional. */
  professionalIds: (string | null)[];
  locationId: string | null;
  date: string;
  /** R250: the asker's own hold, so the time they're holding stays on their list. */
  holdId?: string | null;
}

const unique = <T>(values: Iterable<T>): T[] => [...new Set(values)];

const overlaps = (a: Instant, b: Instant): boolean => a.start < b.end && b.start < a.end;

function isCovered(start: Date, end: Date, windows: Instant[]): boolean {
  let reach = start.getTime();
  for (const window of [...windows].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    if (window.start.getTime() > reach) break;
    reach = Math.max(reach, window.end.getTime());
    if (reach >= end.getTime()) return true;
  }
  return reach >= end.getTime();
}

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly cache: AvailabilityCacheService,
  ) {}

  async computeSlots(input: AvailabilityInput): Promise<AvailabilitySlot[]> {
    const { tenantId } = this.tenantContext.current;
    const date = this.validateDate(input.date);
    validateServiceIds(input.serviceIds);

    return this.prisma.forTenant(async (tx) => {
      const { timezone } = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { timezone: true },
      });

      // R120: a deactivated (or unknown) service yields no availability at all

      const existing = input.excludeAppointmentId
        ? await tx.appointmentService.findMany({
            where: { tenantId, appointmentId: input.excludeAppointmentId },
            select: { serviceId: true, durationMinutes: true, price: true },
          })
        : [];
      const durationMinutes = totalDurationMinutes(
        await resolveServiceLines(tx, tenantId, input.serviceIds, existing),
      );

      const candidates = await this.resolveCandidates(
        tx,
        tenantId,
        input.serviceIds,
        input.professionalId ?? null,
        input.locationId ?? null,
      );
      if (candidates.length === 0) {
        return [];
      }

      const dayStart = zonedTimeToUtc(date, 0, timezone);
      const dayEnd = zonedTimeToUtc(addDaysToDateString(date, 1), 0, timezone);
      const ids = candidates.map((c) => c.id).filter((id): id is string => id !== null);
      const includeUnassigned = candidates.some((c) => c.id === null);

      const scoped = { OR: [...(ids.length > 0 ? [{ professionalId: { in: ids } }] : []), { professionalId: null }] };

      const [businessHours, timeOff, holds, appointments] = await Promise.all([
        tx.businessHours.findMany({ where: { tenantId, dayOfWeek: dayOfWeekForDateString(date), ...scoped } }),
        tx.timeOff.findMany({ where: { tenantId, ...scoped, startAt: { lt: dayEnd }, endAt: { gt: dayStart } } }),
        this.liveHolds(tx, tenantId, ids, dayStart, dayEnd),
        tx.appointment.findMany({
          where: {
            tenantId,
            OR: [
              ...(ids.length > 0 ? [{ professionalId: { in: ids } }] : []),
              ...(includeUnassigned ? [{ professionalId: null }] : []),
            ],
            status: { not: "cancelled" },
            startAt: { lt: dayEnd },
            endAt: { gt: dayStart },
            // R80: an appointment being moved doesn't block itself

            ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
          },
          select: { professionalId: true, startAt: true, endAt: true },
        }),
      ]);

      const now = new Date();
      const slots: AvailabilitySlot[] = [];

      for (const candidate of candidates) {
        const windows = workingWindows(businessHours, candidate.id);
        const busy: Instant[] = [
          ...timeOff
            .filter((block) => block.professionalId === null || block.professionalId === candidate.id)
            .map((block) => ({ start: block.startAt, end: block.endAt })),
          ...appointments
            .filter((appointment) => appointment.professionalId === candidate.id)
            .map((appointment) => ({ start: appointment.startAt, end: appointment.endAt })),
          // R250: a customer is finishing a booking here
          ...holds
            .filter((hold) => hold.professionalId === candidate.id)
            .map((hold) => ({ start: hold.startAt, end: hold.endAt })),
        ];

        for (const window of windows) {
          const lastStart = window.endMinutes - durationMinutes;
          for (let minute = window.startMinutes; minute <= lastStart; minute += SLOT_GRANULARITY_MINUTES) {
            const start = zonedTimeToUtc(date, minute, timezone);
            const end = new Date(start.getTime() + durationMinutes * 60_000);
            if (start < now) continue;
            if (busy.some((interval) => overlaps({ start, end }, interval))) continue;
            slots.push({ startAt: start.toISOString(), endAt: end.toISOString(), professionalId: candidate.id });
          }
        }
      }

      return slots.sort((a, b) => a.startAt.localeCompare(b.startAt));
    });
  }

  async findConflictsIn(tx: Prisma.TransactionClient, input: ConflictCheckInput): Promise<BookingConflict[]> {
    const { tenantId } = this.tenantContext.current;
    const { professionalId, startAt, endAt } = input;

    const { timezone } = await tx.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const professional = professionalId
      ? await tx.professional.findUnique({ where: { id: professionalId }, select: { name: true, nameI18n: true } })
      : null;
    const professionalName = professional?.name ?? null;
    // R160: the CMS shows the name in its own language
    const professionalNameI18n = serializeLocalizedText(professional?.nameI18n ?? null);

    const scoped = {
      OR: [...(professionalId ? [{ professionalId }] : []), { professionalId: null }],
    };

    const [timeOff, holds, appointments] = await Promise.all([
      tx.timeOff.findMany({ where: { tenantId, ...scoped, startAt: { lt: endAt }, endAt: { gt: startAt } } }),
      professionalId ? this.liveHolds(tx, tenantId, [professionalId], startAt, endAt) : Promise.resolve([]),
      tx.appointment.findMany({
        where: {
          tenantId,
          professionalId,
          status: { not: "cancelled" },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
          ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
        },
        select: { userName: true, startAt: true, endAt: true },
      }),
    ]);

    const conflicts: BookingConflict[] = appointments.map((appointment) => ({
      type: "appointment",
      professionalName,
      professionalNameI18n,
      startAt: appointment.startAt.toISOString(),
      endAt: appointment.endAt.toISOString(),
      detail: appointment.userName,
    }));

    // R250: an online customer is finishing a booking for this time
    for (const hold of holds) {
      conflicts.push({
        type: "hold",
        professionalName,
        professionalNameI18n,
        startAt: hold.startAt.toISOString(),
        endAt: hold.endAt.toISOString(),
        detail: null,
      });
    }

    for (const block of timeOff) {
      conflicts.push({
        type: "time_off",
        professionalName: block.professionalId === null ? null : professionalName,
        professionalNameI18n: block.professionalId === null ? null : professionalNameI18n,
        startAt: block.startAt.toISOString(),
        endAt: block.endAt.toISOString(),
        detail: block.reason,
      });
    }

    const localDates = new Set([
      zonedDateString(startAt, timezone),
      zonedDateString(new Date(endAt.getTime() - 1), timezone),
    ]);
    const businessHours = await tx.businessHours.findMany({
      where: { tenantId, ...scoped, dayOfWeek: { in: [...localDates].map(dayOfWeekForDateString) } },
    });

    const openWindows: Instant[] = [];
    for (const date of localDates) {
      for (const window of workingWindows(
        businessHours.filter((row) => row.dayOfWeek === dayOfWeekForDateString(date)),
        professionalId,
      )) {
        openWindows.push({
          start: zonedTimeToUtc(date, window.startMinutes, timezone),
          end: zonedTimeToUtc(date, window.endMinutes, timezone),
        });
      }
    }

    if (!isCovered(startAt, endAt, openWindows)) {
      conflicts.push({
        type: "outside_business_hours",
        professionalName,
        professionalNameI18n,
        startAt: null,
        endAt: null,
        detail: null,
      });
    }

    return conflicts;
  }

  /**
   * R200: every start time on `date` at which the whole visit fits, with the
   * plan behind each. Public booking flow; each service is one unit.
   */
  async computeVisitSlots(query: VisitSlotQuery): Promise<VisitSlot[]> {
    const { tenantId } = this.tenantContext.current;
    validateServiceIds(query.serviceIds);
    if (query.professionalIds.length !== query.serviceIds.length) {
      throw new BadRequestException("professionalIds must have one entry per service");
    }

    // Load-shedding (system_design.md §8); see AvailabilityCacheService. The
    // key is fixed here, before anything is read, and reused to store.
    const cached = await this.cache.lookup(tenantId, query);
    if (cached.slots) return cached.slots;

    return this.prisma.forTenant(async (tx) => {
      // R120: a deactivated (or unknown) service is refused here
      const lines = await resolveServiceLines(tx, tenantId, query.serviceIds);
      const units: VisitUnitSpec[] = lines.map((line, index) => ({
        durationMinutes: line.durationMinutes,
        serviceIds: [line.serviceId],
        professionalId: query.professionalIds[index] ?? null,
      }));
      // The planner's load already read the tenant's notice; reused for the cache.
      const { planner, starts, noticeMs } = await this.loadVisitPlanner(tx, {
        units,
        locationId: query.locationId,
        date: query.date,
        excludeHoldId: query.holdId ?? null,
      });
      const slots = AvailabilityService.toVisitSlots(planVisits(planner, starts), units);
      await this.cache.store(cached.key, { noticeMs, slots });
      return slots;
    });
  }

  /** All plans for `input.date`, one per bookable start time. */
  async visitPlansIn(tx: Prisma.TransactionClient, input: VisitPlanInput): Promise<PlannedVisit[]> {
    const { planner, starts } = await this.loadVisitPlanner(tx, input);
    return planVisits(planner, starts);
  }

  /** The plan for a visit starting exactly at `startAt`, or null if it no longer fits. */
  async visitPlanAtIn(
    tx: Prisma.TransactionClient,
    input: VisitPlanInput,
    startAt: Date,
  ): Promise<PlannedVisit | null> {
    const { planner } = await this.loadVisitPlanner(tx, input);
    return planVisitAt(planner, startAt.getTime());
  }

  /** Wire shape: units merged into the appointments they'll become (R200). */
  static toVisitSlots(plans: readonly PlannedVisit[], units: readonly VisitUnitSpec[]): VisitSlot[] {
    return plans.map((plan) => ({
      startAt: new Date(plan.start).toISOString(),
      endAt: new Date(plan.end).toISOString(),
      segments: groupPlannedUnits(plan.units).map((group) => ({
        serviceIds: group.unitIndexes.flatMap((index) => units[index]?.serviceIds ?? []),
        professionalId: group.professionalId,
        startAt: new Date(group.start).toISOString(),
        endAt: new Date(group.end).toISOString(),
      })),
    }));
  }

  /**
   * Loads one local day into the pure planner's input: who may perform each
   * unit, and each of those professionals' windows and commitments.
   */
  private async loadVisitPlanner(
    tx: Prisma.TransactionClient,
    input: VisitPlanInput,
  ): Promise<{ planner: PlannerInput; starts: number[]; noticeMs: number }> {
    const { tenantId } = this.tenantContext.current;
    const date = this.validateDate(input.date);

    const { timezone, maxVisitGapMinutes, minBookingNoticeMinutes, maxBookingAdvanceDays } =
      await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { timezone: true, maxVisitGapMinutes: true, minBookingNoticeMinutes: true, maxBookingAdvanceDays: true },
      });

    const noticeMs = minBookingNoticeMinutes * 60_000;
    const emptyPlanner: PlannerInput = {
      units: [],
      schedules: new Map(),
      maxGapMinutes: maxVisitGapMinutes,
      gapStepMinutes: VISIT_GAP_STEP_MINUTES,
      // R280: nothing starts sooner than the salon's notice
      notBefore: Date.now() + noticeMs,
    };
    // R290: nothing on a day past the salon's horizon (counted from today on its clock)
    const lastBookableDate = addDaysToDateString(zonedDateString(new Date(), timezone), maxBookingAdvanceDays);
    if (date > lastBookableDate) {
      return { planner: emptyPlanner, starts: [], noticeMs };
    }

    const candidates = await this.visitCandidates(tx, tenantId, input);
    // R240: a unit nobody can perform means the visit can't be planned at all.
    if (candidates.some((list) => list.length === 0)) {
      return { planner: emptyPlanner, starts: [], noticeMs };
    }

    const ids = unique(candidates.flat());
    const dayStart = zonedTimeToUtc(date, 0, timezone);
    const dayEnd = zonedTimeToUtc(addDaysToDateString(date, 1), 0, timezone);
    const scoped = { OR: [{ professionalId: { in: ids } }, { professionalId: null }] };

    const [businessHours, timeOff, holds, appointments] = await Promise.all([
      tx.businessHours.findMany({ where: { tenantId, dayOfWeek: dayOfWeekForDateString(date), ...scoped } }),
      tx.timeOff.findMany({ where: { tenantId, ...scoped, startAt: { lt: dayEnd }, endAt: { gt: dayStart } } }),
      this.liveHolds(tx, tenantId, ids, dayStart, dayEnd, input.excludeHoldId ?? null),
      tx.appointment.findMany({
        where: {
          tenantId,
          professionalId: { in: ids },
          status: { not: "cancelled" },
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
          // An explicit OR: `visitId: { not: X }` alone would also drop every
          // row whose visit_id is NULL (SQL's <> never matches NULL), i.e.
          // every staff booking — which must still block the slot.
          ...(input.excludeVisitId ? { OR: [{ visitId: null }, { visitId: { not: input.excludeVisitId } }] } : {}),
        },
        select: { professionalId: true, startAt: true, endAt: true },
      }),
    ]);

    const schedules = new Map<string, ProfessionalSchedule>();
    const loads = new Map<string, DayWorkload>();
    for (const id of ids) {
      const windows = workingWindows(businessHours, id).map((window) => ({
        start: zonedTimeToUtc(date, window.startMinutes, timezone).getTime(),
        end: zonedTimeToUtc(date, window.endMinutes, timezone).getTime(),
      }));
      const away = timeOff
        .filter((block) => block.professionalId === null || block.professionalId === id)
        .map((block) => ({ start: block.startAt.getTime(), end: block.endAt.getTime() }));
      const booked = [
        ...appointments
          .filter((appointment) => appointment.professionalId === id)
          .map((appointment) => ({ start: appointment.startAt.getTime(), end: appointment.endAt.getTime() })),
        // R250: another customer is finishing a booking here
        ...holds
          .filter((hold) => hold.professionalId === id)
          .map((hold) => ({ start: hold.startAt.getTime(), end: hold.endAt.getTime() })),
      ];
      schedules.set(id, { windows, busy: [...away, ...booked] });
      // R450: how full their day already is, for the fair order below
      loads.set(id, dayWorkload({ day: { start: dayStart.getTime(), end: dayEnd.getTime() }, windows, timeOff: away, booked }));
    }

    const starts: number[] = [];
    for (let minute = 0; minute < 24 * 60; minute += SLOT_GRANULARITY_MINUTES) {
      starts.push(zonedTimeToUtc(date, minute, timezone).getTime());
    }

    return {
      planner: {
        ...emptyPlanner,
        // R450: "any professional" goes to the least-booked first. A unit with a
        // chosen professional has one candidate, so this only orders real choices.
        units: input.units.map((unit, index) => ({
          durationMinutes: unit.durationMinutes,
          candidates: fairOrder(candidates[index] ?? [], loads, date),
        })),
        schedules,
      },
      starts,
      noticeMs,
    };
  }

  /** For each unit, the professionals allowed to perform it (by name; `fairOrder` decides the real order, R450). */
  private async visitCandidates(
    tx: Prisma.TransactionClient,
    tenantId: string,
    input: VisitPlanInput,
  ): Promise<string[][]> {
    const serviceIds = unique(input.units.flatMap((unit) => unit.serviceIds));
    const fixed = new Set(input.units.map((unit) => unit.professionalId).filter((id): id is string => id !== null));

    const assignments = await tx.serviceProfessional.findMany({
      where: { tenantId, serviceId: { in: serviceIds } },
      select: { professionalId: true, serviceId: true },
    });
    const performs = new Map<string, Set<string>>();
    for (const assignment of assignments) {
      const set = performs.get(assignment.professionalId) ?? new Set<string>();
      set.add(assignment.serviceId);
      performs.set(assignment.professionalId, set);
    }

    const professionals = await tx.professional.findMany({
      where: { tenantId, id: { in: unique([...performs.keys(), ...fixed]) } },
      select: { id: true, isActive: true, locationId: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });

    return input.units.map((unit) => {
      const kept = (id: string) => input.keepExistingPairings === true && fixed.has(id);
      return professionals
        .filter((professional) => unit.professionalId === null || professional.id === unit.professionalId)
        .filter((professional) => professional.isActive || kept(professional.id))
        .filter(
          (professional) =>
            // R180: null = works at every location
            input.locationId === null ||
            professional.locationId === null ||
            professional.locationId === input.locationId ||
            kept(professional.id),
        )
        .filter(
          (professional) =>
            kept(professional.id) || unit.serviceIds.every((id) => performs.get(professional.id)?.has(id) === true),
        )
        .map((professional) => professional.id);
    });
  }

  /**
   * R250: unexpired holds on these professionals overlapping [from, to). Expired
   * rows are filtered here rather than trusted to have been deleted.
   */
  private liveHolds(
    tx: Prisma.TransactionClient,
    tenantId: string,
    professionalIds: string[],
    from: Date,
    to: Date,
    excludeHoldId: string | null = null,
  ): Promise<{ professionalId: string; startAt: Date; endAt: Date }[]> {
    if (professionalIds.length === 0) {
      return Promise.resolve([]);
    }
    return tx.slotHold.findMany({
      where: {
        tenantId,
        professionalId: { in: professionalIds },
        expiresAt: { gt: new Date() },
        startAt: { lt: to },
        endAt: { gt: from },
        ...(excludeHoldId ? { holdId: { not: excludeHoldId } } : {}),
      },
      select: { professionalId: true, startAt: true, endAt: true },
    });
  }

  private validateDate(date: string): string {
    try {
      parseDateOnly(date);
    } catch {
      throw new BadRequestException("date must be a YYYY-MM-DD calendar date");
    }
    return date;
  }

  private async resolveCandidates(
    tx: Prisma.TransactionClient,
    tenantId: string,
    serviceIds: string[],
    professionalId: string | null,
    locationId: string | null,
  ): Promise<Candidate[]> {
    const assignments = await tx.serviceProfessional.findMany({
      where: { tenantId, serviceId: { in: serviceIds }, ...(professionalId ? { professionalId } : {}) },
      select: { professionalId: true, serviceId: true },
    });

    const serviceCount = new Map<string, Set<string>>();
    for (const assignment of assignments) {
      const services = serviceCount.get(assignment.professionalId) ?? new Set<string>();
      services.add(assignment.serviceId);
      serviceCount.set(assignment.professionalId, services);
    }
    const qualifiedIds = [...serviceCount.entries()]
      .filter(([, services]) => services.size === new Set(serviceIds).size)
      .map(([id]) => id);

    if (qualifiedIds.length === 0) {
      return professionalId ? [] : [{ id: null, name: null }];
    }

    const professionals = await tx.professional.findMany({
      where: {
        tenantId,
        id: { in: qualifiedIds },
        isActive: true,
        // R180: an OR, not an `in` — SQL's IN never matches NULL

        ...(locationId ? { OR: [{ locationId }, { locationId: null }] } : {}),
      },
      select: { id: true, name: true },
    });
    return professionals.map((p) => ({ id: p.id, name: p.name }));
  }
}
