import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { BookingConflictResponse } from "@booking/shared-types";
import { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { APPOINTMENT_SUMMARY_INCLUDE, type PrismaAppointmentSummary } from "../common/serializers.js";
import { parseTimeOfDay, zonedTimeToUtc } from "../common/timezone.js";
import { AvailabilityService } from "./availability.service.js";

/**
 * Writes to `Appointment`, shared by the CMS booking flow and (once its
 * endpoints are implemented) the public magic-link flow.
 *
 * Everything both paths must agree on lives here: `end_at` derived from the
 * service duration, `price` snapshotted at creation, the availability check, and
 * magic-link token rotation on reschedule. What differs is one flag — a CMS
 * booking issues no token at all (R70) — and whether a conflict is fatal.
 */

// Magic-link lifetime past the appointment (Data Model doc, "Booking Access"):
// the customer keeps a working link for a day after the appointment ends.
const MAGIC_LINK_GRACE_MS = 24 * 60 * 60 * 1000;

function requireText(value: string, field: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    throw new BadRequestException(`${field} is required`);
  }
  return trimmed;
}

export interface CreateBookingInput {
  serviceId: string;
  /** null = "any available" (no professional pinned to the row). */
  professionalId: string | null;
  /** "YYYY-MM-DD" + "HH:mm", both read in the tenant's timezone. */
  date: string;
  time: string;
  userName: string;
  phoneNumber: string;
  email?: string | null;
  notes?: string | null;
  /** TenantUser who created it; null only for a customer's own public booking. */
  createdByUserId: string | null;
  /** R60: book despite named conflicts. */
  override?: boolean;
}

export interface RescheduleBookingInput {
  appointmentId: string;
  /** Both or neither — a time move needs its date. */
  date?: string;
  time?: string;
  professionalId?: string;
  override?: boolean;
  /**
   * Set for `professional` logins: the only professional whose appointments
   * they may touch (R20). RLS can't express this — it scopes rows to a tenant
   * and knows nothing about roles within one — so it's applied here.
   */
  professionalScope: string | null;
}

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly availability: AvailabilityService,
  ) {}

  /**
   * Creates a booking staff made on a customer's behalf: no magic-link token is
   * issued and no notification is sent (R70) — these appointments are managed
   * by staff only.
   */
  async create(input: CreateBookingInput): Promise<PrismaAppointmentSummary> {
    const { tenantId } = this.tenantContext.current;
    const userName = requireText(input.userName, "userName");
    const phoneNumber = requireText(input.phoneNumber, "phoneNumber");

    return this.prisma.forTenant(async (tx) => {
      const { timezone } = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { timezone: true },
      });

      const service = await this.loadBookableService(tx, tenantId, input.serviceId, input.professionalId);
      const startAt = this.resolveStartAt(input.date, input.time, timezone);
      const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);

      await this.assertBookable(tx, {
        professionalId: input.professionalId,
        startAt,
        endAt,
        override: input.override ?? false,
      });

      return tx.appointment.create({
        data: {
          tenantId,
          serviceId: service.id,
          professionalId: input.professionalId,
          userName,
          phoneNumber,
          // Optional on the form (R30) but NOT NULL in the schema, which the
          // public flow relies on to have somewhere to send the magic link.
          email: input.email?.trim() ?? "",
          startAt,
          // R40: derived from the service duration, not accepted from the client.
          endAt,
          // R40: snapshot — a later price change must not rewrite history.
          price: service.price,
          notes: input.notes?.trim() || null,
          createdByUserId: input.createdByUserId,
          // R70: staff-created bookings carry no customer link, so there is
          // nothing to expire either.
          accessTokenHash: null,
          accessTokenExpiresAt: null,
        },
        include: APPOINTMENT_SUMMARY_INCLUDE,
      });
    });
  }

  /** R80: move an appointment in time and/or to another professional. */
  async reschedule(input: RescheduleBookingInput): Promise<PrismaAppointmentSummary> {
    const { tenantId } = this.tenantContext.current;
    if ((input.date === undefined) !== (input.time === undefined)) {
      throw new BadRequestException("date and time must be sent together");
    }
    if (input.date === undefined && input.professionalId === undefined) {
      throw new BadRequestException("a reschedule must change the time, the professional, or both");
    }

    return this.prisma.forTenant(async (tx) => {
      const { timezone } = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { timezone: true },
      });

      const existing = await this.loadOwnAppointment(tx, tenantId, input.appointmentId, input.professionalScope);
      if (existing.status === "cancelled") {
        // R90 keeps cancelled rows as history; reviving one is a status change
        // the staff member makes deliberately first, not a side effect of a move.
        throw new BadRequestException("a cancelled appointment can't be rescheduled");
      }

      const professionalId = input.professionalId ?? existing.professionalId;
      // R140 applies to the new pairing just as it does at creation. R120 does
      // not: it governs *new* bookings, and an appointment that already exists
      // must stay movable even if its service or its professional was
      // deactivated since — otherwise deactivating a departing stylist would
      // strand every appointment already on their calendar. Moving one *to*
      // another professional still requires that professional to be active.
      const service = await this.loadBookableService(tx, tenantId, existing.serviceId, professionalId, {
        allowInactiveService: true,
        allowInactiveProfessional: professionalId === existing.professionalId,
      });

      const startAt =
        input.date !== undefined && input.time !== undefined
          ? this.resolveStartAt(input.date, input.time, timezone)
          : existing.startAt;
      const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);

      await this.assertBookable(tx, {
        professionalId,
        startAt,
        endAt,
        override: input.override ?? false,
        excludeAppointmentId: existing.id,
      });

      return tx.appointment.update({
        where: { id: existing.id, tenantId },
        // `price` is deliberately absent: it was snapshotted at creation (R40)
        // and moving an appointment doesn't re-quote it.
        data: {
          professionalId,
          startAt,
          endAt,
          ...this.rotatedToken(existing.accessTokenHash, endAt),
        },
        include: APPOINTMENT_SUMMARY_INCLUDE,
      });
    });
  }

  /**
   * R110: a customer-created booking's magic link is invalidated whenever the
   * appointment moves, whichever path moved it — so the CMS can't hand a
   * customer a link that points at a stale time.
   *
   * The replacement token is generated and stored hashed, and its plaintext is
   * dropped on the floor: nothing in this codebase delivers email yet (customer
   * notifications are out of scope platform-wide), so there is no recipient to
   * hand it to. The customer recovers the new link through the existing
   * resend-by-phone-number flow. Returning no fields at all leaves a
   * staff-created booking exactly as it was — tokenless.
   */
  private rotatedToken(
    currentHash: string | null,
    endAt: Date,
  ): Pick<Prisma.AppointmentUncheckedUpdateInput, "accessTokenHash" | "accessTokenExpiresAt"> {
    if (currentHash === null) {
      return {};
    }
    const token = randomBytes(32).toString("hex");
    return {
      accessTokenHash: createHash("sha256").update(token).digest("hex"),
      accessTokenExpiresAt: new Date(endAt.getTime() + MAGIC_LINK_GRACE_MS),
    };
  }

  /**
   * The appointment, restricted to the caller's own when `professionalScope` is
   * set. "Not yours" and "doesn't exist" answer identically on purpose — a
   * professional shouldn't be able to probe for a colleague's appointment ids.
   */
  async loadOwnAppointment(
    tx: Prisma.TransactionClient,
    tenantId: string,
    appointmentId: string,
    professionalScope: string | null,
  ) {
    const appointment = await tx.appointment.findFirst({
      where: { id: appointmentId, tenantId, ...(professionalScope ? { professionalId: professionalScope } : {}) },
    });
    if (!appointment) {
      throw new NotFoundException("Appointment not found");
    }
    return appointment;
  }

  /** R130: wall-clock date + time resolved against the tenant's own timezone. */
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

  /**
   * R120: neither a deactivated service nor a deactivated professional can take
   * a new booking. R140: the two must actually be paired via
   * ServiceProfessional, otherwise the combination isn't offered at all.
   *
   * The two `allowInactive*` options exist for the reschedule path, where the
   * booking already exists: a deactivation since then is a reason not to take
   * *new* bookings, not a reason to freeze the ones on the books.
   */
  private async loadBookableService(
    tx: Prisma.TransactionClient,
    tenantId: string,
    serviceId: string,
    professionalId: string | null,
    options: { allowInactiveService?: boolean; allowInactiveProfessional?: boolean } = {},
  ) {
    const service = await tx.service.findFirst({ where: { id: serviceId, tenantId } });
    if (!service) {
      throw new NotFoundException("Service not found");
    }
    if (!service.isActive && !options.allowInactiveService) {
      throw new BadRequestException(`"${service.name}" is deactivated and can't take new bookings`);
    }

    if (professionalId !== null) {
      const professional = await tx.professional.findFirst({ where: { id: professionalId, tenantId } });
      if (!professional) {
        throw new NotFoundException("Professional not found");
      }
      if (!professional.isActive && !options.allowInactiveProfessional) {
        throw new BadRequestException(`${professional.name} is deactivated and can't take new bookings`);
      }
      const assignment = await tx.serviceProfessional.findFirst({
        where: { tenantId, serviceId, professionalId },
      });
      if (!assignment) {
        throw new BadRequestException(`${professional.name} doesn't perform "${service.name}"`);
      }
    }

    return service;
  }

  /**
   * R60: a conflict is a warning, not a wall — but the caller has to have seen
   * it. Unconfirmed, the 409 body names every collision so the CMS can render
   * "Levan already has an appointment at 14:00" and offer to proceed; confirmed
   * (`override`), the overlapping row is created for real. Anything reading
   * appointments must therefore tolerate overlaps.
   */
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
