import { BadRequestException, Injectable } from "@nestjs/common";
import type { AvailabilitySlot, BookingConflict } from "@booking/shared-types";
import type { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import {
  addDaysToDateString,
  dayOfWeekForDateString,
  parseDateOnly,
  zonedDateString,
  zonedTimeToUtc,
} from "../common/timezone.js";
import { resolveServiceLines, totalDurationMinutes, validateServiceIds } from "./service-lines.js";

/**
 * The one implementation of "when is this bookable", used by both the public
 * booking flow and the CMS (system_design.md §5: availability is computed at
 * query time, never stored). Slots are BusinessHours minus TimeOff minus
 * existing Appointments.
 *
 * Enforcement is deliberately *not* this service's job. It reports what is open
 * (`computeSlots`) and what a given window collides with (`findConflictsIn`);
 * whether a collision blocks the write is the caller's call — the public site
 * refuses, the CMS lets staff override with a warning (R60). Keeping the
 * computation in one place is what makes the two paths agree about reality.
 */

// Grid the offered start times sit on. Coarser than a minute so the list stays
// scannable, finer than a service duration so a 45-minute service doesn't force
// 45-minute increments and lose the 15-minute gaps between other bookings.
export const SLOT_GRANULARITY_MINUTES = 15;

interface Instant {
  start: Date;
  end: Date;
}

/** A professional a slot can be offered for; `id: null` = "no professional". */
interface Candidate {
  id: string | null;
  name: string | null;
}

export interface AvailabilityInput {
  serviceIds: string[];
  /** null/undefined = every professional who can perform the service(s). */
  professionalId?: string | null;
  /** "YYYY-MM-DD", in the tenant's timezone. */
  date: string;
  /**
   * The appointment being moved. It occupies its own slot, so without this the
   * reschedule picker hides every time the appointment already covers — the
   * same self-exclusion `findConflictsIn` does (R80).
   */
  excludeAppointmentId?: string;
}

export interface ConflictCheckInput {
  professionalId: string | null;
  startAt: Date;
  endAt: Date;
  /** The appointment being moved — it never conflicts with itself (R80). */
  excludeAppointmentId?: string;
}

const overlaps = (a: Instant, b: Instant): boolean => a.start < b.end && b.start < a.end;

/** True when [start, end) is fully covered by the union of `windows`. */
function isCovered(start: Date, end: Date, windows: Instant[]): boolean {
  let reach = start.getTime();
  for (const window of [...windows].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    // A gap before this window means the span isn't contiguously covered.
    if (window.start.getTime() > reach) break;
    reach = Math.max(reach, window.end.getTime());
    if (reach >= end.getTime()) return true;
  }
  return reach >= end.getTime();
}

const timeToMinutes = (time: Date): number => time.getUTCHours() * 60 + time.getUTCMinutes();

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Genuinely open start times for `date`, one entry per (time, professional).
   * Past times are never offered (R130); a slot must fit entirely inside a
   * business-hours window and touch no TimeOff block or live Appointment.
   */
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
      // rather than slots the booking call would then reject — except on the
      // one already booked, whose lines come from the appointment being edited.
      // Resolved through the same helper BookingService writes with, so the
      // window offered here is exactly the window that will be booked.
      const existing = input.excludeAppointmentId
        ? await tx.appointmentService.findMany({
            where: { tenantId, appointmentId: input.excludeAppointmentId },
            select: { serviceId: true, durationMinutes: true, price: true },
          })
        : [];
      const durationMinutes = totalDurationMinutes(
        await resolveServiceLines(tx, tenantId, input.serviceIds, existing),
      );

      const candidates = await this.resolveCandidates(tx, tenantId, input.serviceIds, input.professionalId ?? null);
      if (candidates.length === 0) {
        return [];
      }

      const dayStart = zonedTimeToUtc(date, 0, timezone);
      const dayEnd = zonedTimeToUtc(addDaysToDateString(date, 1), 0, timezone);
      const ids = candidates.map((c) => c.id).filter((id): id is string => id !== null);
      const includeUnassigned = candidates.some((c) => c.id === null);
      // Written as an OR rather than `in: [...ids, null]` because SQL's IN never
      // matches NULL, and the tenant-wide rows (professional_id IS NULL) are
      // exactly the ones that must always come along.
      const scoped = { OR: [...(ids.length > 0 ? [{ professionalId: { in: ids } }] : []), { professionalId: null }] };

      const [businessHours, timeOff, appointments] = await Promise.all([
        tx.businessHours.findMany({ where: { tenantId, dayOfWeek: dayOfWeekForDateString(date), ...scoped } }),
        tx.timeOff.findMany({ where: { tenantId, ...scoped, startAt: { lt: dayEnd }, endAt: { gt: dayStart } } }),
        // Cancelled appointments free their slot again (R90); everything else
        // (booked/completed/no_show) still occupied the chair.
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
            // R80: an appointment being moved doesn't block itself, or the
            // reschedule picker would hide every slot it currently covers.
            ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
          },
          select: { professionalId: true, startAt: true, endAt: true },
        }),
      ]);

      const now = new Date();
      const slots: AvailabilitySlot[] = [];

      for (const candidate of candidates) {
        const windows = this.windowsFor(businessHours, candidate.id);
        const busy: Instant[] = [
          ...timeOff
            .filter((block) => block.professionalId === null || block.professionalId === candidate.id)
            .map((block) => ({ start: block.startAt, end: block.endAt })),
          ...appointments
            .filter((appointment) => appointment.professionalId === candidate.id)
            .map((appointment) => ({ start: appointment.startAt, end: appointment.endAt })),
        ];

        for (const window of windows) {
          // Fit is checked in wall-clock minutes, not instants: on a DST day the
          // window is still "09:00–17:00" locally even though it spans 7 or 9
          // hours of real time.
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

  /**
   * Everything the window [startAt, endAt) collides with, named well enough for
   * the CMS to say *which* conflict it is (R60). Empty means the window is open.
   *
   * Takes the caller's transaction rather than opening its own, so a booking
   * writes against exactly the state it checked — a separate transaction could
   * see a competing booking land in between.
   */
  async findConflictsIn(tx: Prisma.TransactionClient, input: ConflictCheckInput): Promise<BookingConflict[]> {
    const { tenantId } = this.tenantContext.current;
    const { professionalId, startAt, endAt } = input;

    const { timezone } = await tx.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const professional = professionalId
      ? await tx.professional.findUnique({ where: { id: professionalId }, select: { name: true } })
      : null;
    const professionalName = professional?.name ?? null;

    // Own blocks plus the tenant-wide ones (professional_id IS NULL), which SQL's
    // IN would never match — see the same OR in computeSlots.
    const scoped = {
      OR: [...(professionalId ? [{ professionalId }] : []), { professionalId: null }],
    };

    const [timeOff, appointments] = await Promise.all([
      tx.timeOff.findMany({ where: { tenantId, ...scoped, startAt: { lt: endAt }, endAt: { gt: startAt } } }),
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
      startAt: appointment.startAt.toISOString(),
      endAt: appointment.endAt.toISOString(),
      detail: appointment.userName,
    }));

    for (const block of timeOff) {
      conflicts.push({
        type: "time_off",
        professionalName: block.professionalId === null ? null : professionalName,
        startAt: block.startAt.toISOString(),
        endAt: block.endAt.toISOString(),
        detail: block.reason,
      });
    }

    // An appointment may straddle midnight, so collect the hours of every local
    // day it touches; `endAt` is exclusive, hence the 1ms step back.
    const localDates = new Set([
      zonedDateString(startAt, timezone),
      zonedDateString(new Date(endAt.getTime() - 1), timezone),
    ]);
    const businessHours = await tx.businessHours.findMany({
      where: { tenantId, ...scoped, dayOfWeek: { in: [...localDates].map(dayOfWeekForDateString) } },
    });

    const openWindows: Instant[] = [];
    for (const date of localDates) {
      for (const window of this.windowsFor(
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
      conflicts.push({ type: "outside_business_hours", professionalName, startAt: null, endAt: null, detail: null });
    }

    return conflicts;
  }

  private validateDate(date: string): string {
    try {
      parseDateOnly(date);
    } catch {
      throw new BadRequestException("date must be a YYYY-MM-DD calendar date");
    }
    return date;
  }

  /**
   * Whose calendars to offer. A professional given explicitly must be active
   * and assigned to every requested service (R120/R140), otherwise the pairing
   * simply has no availability. With nobody assigned to the service at all, the
   * tenant-wide hours are the only thing left — that's the `id: null`
   * ("any available") calendar the public site books into.
   */
  private async resolveCandidates(
    tx: Prisma.TransactionClient,
    tenantId: string,
    serviceIds: string[],
    professionalId: string | null,
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
      where: { tenantId, id: { in: qualifiedIds }, isActive: true },
      select: { id: true, name: true },
    });
    return professionals.map((p) => ({ id: p.id, name: p.name }));
  }

  /**
   * A professional's own hours for the day, falling back to the tenant-wide
   * rows (`professional_id IS NULL`) when they have none of their own — those
   * are the tenant's default, not an addition to a personal schedule.
   */
  private windowsFor(
    businessHours: { professionalId: string | null; startTime: Date; endTime: Date }[],
    professionalId: string | null,
  ): { startMinutes: number; endMinutes: number }[] {
    const own = professionalId ? businessHours.filter((row) => row.professionalId === professionalId) : [];
    const rows = own.length > 0 ? own : businessHours.filter((row) => row.professionalId === null);
    return rows
      .map((row) => ({ startMinutes: timeToMinutes(row.startTime), endMinutes: timeToMinutes(row.endTime) }))
      // end <= start would be an overnight or malformed row; slot generation has
      // no meaning for it, so it contributes no open time rather than looping.
      .filter((window) => window.endMinutes > window.startMinutes);
  }
}
