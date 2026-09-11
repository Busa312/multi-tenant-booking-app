import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { BookingConflictResponse } from "@booking/shared-types";
import { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { APPOINTMENT_SUMMARY_INCLUDE, type PrismaAppointmentSummary } from "../common/serializers.js";
import { parseTimeOfDay, zonedTimeToUtc } from "../common/timezone.js";
import { AvailabilityService } from "./availability.service.js";
import {
  resolveServiceLines,
  totalDurationMinutes,
  totalPrice,
  type ResolvedServiceLine,
} from "./service-lines.js";

const MAGIC_LINK_GRACE_MS = 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function requireText(value: string, field: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    throw new BadRequestException(`${field} is required`);
  }
  return trimmed;
}

export interface CreateBookingInput {
  serviceIds: string[];

  professionalId: string | null;
  // R150: the branch
  locationId?: string | null;

  date: string;
  time: string;
  userName: string;
  phoneNumber: string;
  email?: string | null;
  notes?: string | null;

  createdByUserId: string | null;
  // R60: book despite named conflicts
  override?: boolean;
  // R70: staff bookings are tokenless and stay that way
  issueMagicLink?: boolean;
}

export interface BookingResult {
  appointment: PrismaAppointmentSummary;

  magicLinkToken: string | null;
}

export interface UpdateBookingInput {
  appointmentId: string;

  date?: string;
  time?: string;
  professionalId?: string;
  // R150: omitted = stays at the branch it is already booked
  locationId?: string;

  serviceIds?: string[];
  override?: boolean;

  professionalScope: string | null;
}

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly availability: AvailabilityService,
  ) {}

  async create(input: CreateBookingInput): Promise<BookingResult> {
    const { tenantId } = this.tenantContext.current;
    const userName = requireText(input.userName, "userName");
    const phoneNumber = requireText(input.phoneNumber, "phoneNumber");

    return this.prisma.forTenant(async (tx) => {
      const { timezone } = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { timezone: true },
      });

      const lines = await resolveServiceLines(tx, tenantId, input.serviceIds);
      const professional = await this.assertPairing(tx, tenantId, lines, input.professionalId);
      const locationId = await this.resolveLocation(tx, tenantId, input.locationId, professional);
      const startAt = this.resolveStartAt(input.date, input.time, timezone);
      const endAt = new Date(startAt.getTime() + totalDurationMinutes(lines) * 60_000);

      await this.assertBookable(tx, {
        professionalId: input.professionalId,
        startAt,
        endAt,
        override: input.override ?? false,
      });

      const magicLink = input.issueMagicLink ? this.issueToken(endAt) : null;

      const appointment = await tx.appointment.create({
        data: {
          tenantId,
          professionalId: input.professionalId,
          // R150: recorded so the confirmation and the magic link can say where

          locationId,
          userName,
          phoneNumber,
          email: input.email?.trim() ?? "",
          startAt,
          // R40: derived from the summed service durations

          endAt,
          // R40: snapshot — a later price change must not rewrite history
          price: totalPrice(lines),
          notes: input.notes?.trim() || null,
          createdByUserId: input.createdByUserId,
          // R70: staff-created bookings carry no customer link

          accessTokenHash: magicLink?.accessTokenHash ?? null,
          accessTokenExpiresAt: magicLink?.accessTokenExpiresAt ?? null,
          services: { create: lines.map((line) => this.lineData(tenantId, line)) },
        },
        include: APPOINTMENT_SUMMARY_INCLUDE,
      });

      return { appointment, magicLinkToken: magicLink?.token ?? null };
    });
  }

  // R80: move an appointment in time and/or to another professional
  async update(input: UpdateBookingInput): Promise<BookingResult> {
    const { tenantId } = this.tenantContext.current;
    if ((input.date === undefined) !== (input.time === undefined)) {
      throw new BadRequestException("date and time must be sent together");
    }
    if (
      input.date === undefined &&
      input.professionalId === undefined &&
      input.serviceIds === undefined &&
      input.locationId === undefined
    ) {
      throw new BadRequestException(
        "an update must change the time, the professional, the location, the services, or some of them",
      );
    }

    return this.prisma.forTenant(async (tx) => {
      const { timezone } = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { timezone: true },
      });

      const existing = await this.loadOwnAppointment(tx, tenantId, input.appointmentId, input.professionalScope);
      if (existing.status === "cancelled") {
        throw new BadRequestException("a cancelled appointment can't be updated");
      }

      const professionalId = input.professionalId ?? existing.professionalId;

      const lines = await resolveServiceLines(
        tx,
        tenantId,
        input.serviceIds ?? existing.services.map((line) => line.serviceId),
        existing.services,
      );

      const professional = await this.assertPairing(tx, tenantId, lines, professionalId, {
        allowInactiveProfessional: professionalId === existing.professionalId,
      });

      const locationId = await this.resolveLocation(tx, tenantId, input.locationId ?? existing.locationId, professional, {
        currentLocationId: existing.locationId,
        existing: true,
        professionalUnchanged: professionalId === existing.professionalId,
      });

      const startAt =
        input.date !== undefined && input.time !== undefined
          ? this.resolveStartAt(input.date, input.time, timezone)
          : existing.startAt;
      const endAt = new Date(startAt.getTime() + totalDurationMinutes(lines) * 60_000);

      await this.assertBookable(tx, {
        professionalId,
        startAt,
        endAt,
        override: input.override ?? false,
        excludeAppointmentId: existing.id,
      });

      if (input.serviceIds !== undefined) {
        await tx.appointmentService.deleteMany({ where: { tenantId, appointmentId: existing.id } });
        await tx.appointmentService.createMany({
          data: lines.map((line) => ({ appointmentId: existing.id, ...this.lineData(tenantId, line) })),
        });
      }

      // R110: rotated whenever the appointment moves

      const rotated = this.rotatedToken(existing.accessTokenHash, endAt);

      const appointment = await tx.appointment.update({
        where: { id: existing.id, tenantId },
        data: {
          professionalId,
          locationId,
          startAt,
          endAt,
          price: totalPrice(lines),
          ...(rotated
            ? { accessTokenHash: rotated.accessTokenHash, accessTokenExpiresAt: rotated.accessTokenExpiresAt }
            : {}),
        },
        include: APPOINTMENT_SUMMARY_INCLUDE,
      });

      return { appointment, magicLinkToken: rotated?.token ?? null };
    });
  }

  // R70: a staff-created booking never had a link to reissue
  async reissueToken(appointmentId: string): Promise<Pick<BookingResult, "magicLinkToken">> {
    const { tenantId } = this.tenantContext.current;

    return this.prisma.forTenant(async (tx) => {
      const existing = await tx.appointment.findFirst({
        where: { id: appointmentId, tenantId },
        select: { accessTokenHash: true, endAt: true },
      });
      if (!existing?.accessTokenHash) {
        return { magicLinkToken: null };
      }

      const issued = this.issueToken(existing.endAt);
      await tx.appointment.update({
        where: { id: appointmentId, tenantId },
        data: {
          accessTokenHash: issued.accessTokenHash,
          accessTokenExpiresAt: issued.accessTokenExpiresAt,
        },
      });
      return { magicLinkToken: issued.token };
    });
  }

  private lineData(tenantId: string, line: ResolvedServiceLine) {
    return {
      tenantId,
      serviceId: line.serviceId,
      position: line.position,
      durationMinutes: line.durationMinutes,
      price: line.price,
    };
  }

  // R110: a customer-created booking's magic link is invalidated whenever
  private rotatedToken(currentHash: string | null, endAt: Date): ReturnType<BookingService["issueToken"]> | null {
    if (currentHash === null) {
      return null;
    }
    return this.issueToken(endAt);
  }

  private issueToken(endAt: Date): {
    token: string;
    accessTokenHash: string;
    accessTokenExpiresAt: Date;
  } {
    const token = randomBytes(32).toString("hex");
    return {
      token,
      accessTokenHash: hashToken(token),
      accessTokenExpiresAt: new Date(endAt.getTime() + MAGIC_LINK_GRACE_MS),
    };
  }

  async loadOwnAppointment(
    tx: Prisma.TransactionClient,
    tenantId: string,
    appointmentId: string,
    professionalScope: string | null,
  ) {
    const appointment = await tx.appointment.findFirst({
      where: { id: appointmentId, tenantId, ...(professionalScope ? { professionalId: professionalScope } : {}) },
      include: { services: { orderBy: { position: "asc" } } },
    });
    if (!appointment) {
      throw new NotFoundException("Appointment not found");
    }
    return appointment;
  }

  // R130: wall-clock date + time resolved against the tenant's own timezone
  private resolveStartAt(date: string, time: string, timezone: string): Date {
    let startAt: Date;
    try {
      startAt = zonedTimeToUtc(date, parseTimeOfDay(time), timezone);
    } catch {
      throw new BadRequestException("date must be YYYY-MM-DD and time must be HH:mm");
    }
    if (startAt.getTime() < Date.now()) {
      throw new BadRequestException("a booking can't be created in the past");
    }
    return startAt;
  }

  // R120: a deactivated professional can't take a new booking
  private async assertPairing(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lines: readonly ResolvedServiceLine[],
    professionalId: string | null,
    options: { allowInactiveProfessional?: boolean } = {},
  ): Promise<{ name: string; locationId: string | null } | null> {
    if (professionalId === null) {
      return null;
    }
    const professional = await tx.professional.findFirst({ where: { id: professionalId, tenantId } });
    if (!professional) {
      throw new NotFoundException("Professional not found");
    }
    if (!professional.isActive && !options.allowInactiveProfessional) {
      throw new BadRequestException(`${professional.name} is deactivated and can't take new bookings`);
    }

    const assignments = await tx.serviceProfessional.findMany({
      where: { tenantId, professionalId, serviceId: { in: lines.map((line) => line.serviceId) } },
      select: { serviceId: true },
    });
    const performed = new Set(assignments.map((assignment) => assignment.serviceId));

    const missing = lines.find((line) => !performed.has(line.serviceId));
    if (missing) {
      throw new BadRequestException(`${professional.name} doesn't perform "${missing.name}"`);
    }

    return { name: professional.name, locationId: professional.locationId };
  }

  // R150: resolves which branch an appointment is booked at
  private async resolveLocation(
    tx: Prisma.TransactionClient,
    tenantId: string,
    requested: string | null | undefined,
    professional: { name: string; locationId: string | null } | null,
    options: { currentLocationId?: string | null; existing?: boolean; professionalUnchanged?: boolean } = {},
  ): Promise<string | null> {
    const locations = await tx.location.findMany({
      where: { tenantId },
      select: { id: true, name: true, isActive: true },
    });
    const bookable = locations.filter((location) => location.isActive);

    if (bookable.length === 0) {
      if (requested) {
        throw new BadRequestException("this business has no locations to book at");
      }
      return null;
    }

    if (!requested) {
      // An appointment booked before the tenant had any location carries null,
      // and must stay reschedulable: requiring one here would strand every row
      // that predates the first location the moment it is created. Moving such
      // an appointment to a branch is still possible — it just has to be asked
      // for, rather than demanded on an unrelated time change.
      if (options.existing && options.currentLocationId == null) {
        return null;
      }
      throw new BadRequestException("locationId is required — this business books by location");
    }

    const location = locations.find((candidate) => candidate.id === requested);
    if (!location) {
      throw new NotFoundException("Location not found");
    }

    if (!location.isActive && options.currentLocationId !== location.id) {
      throw new BadRequestException(`${location.name} is closed and can't take new bookings`);
    }

    // Skipped only when neither side of the pairing is being changed: the
    // appointment is already there, and reassigning a stylist to another branch
    // must not freeze the bookings still on their calendar. Moving an
    // appointment *to* a professional who works elsewhere is still refused.
    // Same allowance `allowInactiveProfessional` makes for deactivation.
    const pairingUnchanged =
      options.existing === true &&
      options.professionalUnchanged === true &&
      options.currentLocationId === location.id;
    if (
      !pairingUnchanged &&
      professional &&
      professional.locationId !== null &&
      professional.locationId !== location.id
    ) {
      throw new BadRequestException(`${professional.name} doesn't work at ${location.name}`);
    }

    return location.id;
  }

  // R60: a conflict is a warning
  private async assertBookable(
    tx: Prisma.TransactionClient,
    input: { professionalId: string | null; startAt: Date; endAt: Date; override: boolean; excludeAppointmentId?: string },
  ): Promise<void> {
    if (input.override) {
      return;
    }
    const conflicts = await this.availability.findConflictsIn(tx, {
      professionalId: input.professionalId,
      startAt: input.startAt,
      endAt: input.endAt,
      excludeAppointmentId: input.excludeAppointmentId,
    });
    if (conflicts.length > 0) {
      const body: BookingConflictResponse = { code: "booking_conflict", conflicts };
      throw new ConflictException(body);
    }
  }
}
