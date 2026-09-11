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

const timeToMinutes = (time: Date): number => time.getUTCHours() * 60 + time.getUTCMinutes();

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
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

      const [businessHours, timeOff, appointments] = await Promise.all([
        tx.businessHours.findMany({ where: { tenantId, dayOfWeek: dayOfWeekForDateString(date), ...scoped } }),
        tx.timeOff.findMany({ where: { tenantId, ...scoped, startAt: { lt: dayEnd }, endAt: { gt: dayStart } } }),
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
      ? await tx.professional.findUnique({ where: { id: professionalId }, select: { name: true } })
      : null;
    const professionalName = professional?.name ?? null;

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

  private windowsFor(
    businessHours: { professionalId: string | null; startTime: Date; endTime: Date }[],
    professionalId: string | null,
  ): { startMinutes: number; endMinutes: number }[] {
    const own = professionalId ? businessHours.filter((row) => row.professionalId === professionalId) : [];
    const rows = own.length > 0 ? own : businessHours.filter((row) => row.professionalId === null);
    return rows
      .map((row) => ({ startMinutes: timeToMinutes(row.startTime), endMinutes: timeToMinutes(row.endTime) }))

      .filter((window) => window.endMinutes > window.startMinutes);
  }
}
