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
  /** One or more, in the order they run. A service may appear only once. */
  serviceIds: string[];
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

export interface UpdateBookingInput {
  appointmentId: string;
  /** Both or neither — a time move needs its date. */
  date?: string;
  time?: string;
  professionalId?: string;
  /** Replaces the whole service list; services already on it keep their price. */
  serviceIds?: string[];
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

      const lines = await resolveServiceLines(tx, tenantId, input.serviceIds);
      await this.assertPairing(tx, tenantId, lines, input.professionalId);
      const startAt = this.resolveStartAt(input.date, input.time, timezone);
      const endAt = new Date(startAt.getTime() + totalDurationMinutes(lines) * 60_000);

      await this.assertBookable(tx, {
        professionalId: input.professionalId,
        startAt,
        endAt,
        override: input.override ?? false,
      });

      return tx.appointment.create({
        data: {
          tenantId,
          professionalId: input.professionalId,
          userName,
          phoneNumber,
          // Optional on the form (R30) but NOT NULL in the schema, which the
          // public flow relies on to have somewhere to send the magic link.
          email: input.email?.trim() ?? "",
          startAt,
          // R40: derived from the summed service durations, not accepted from
          // the client.
          endAt,
          // R40: snapshot — a later price change must not rewrite history.
          price: totalPrice(lines),
          notes: input.notes?.trim() || null,
          createdByUserId: input.createdByUserId,
          // R70: staff-created bookings carry no customer link, so there is
          // nothing to expire either.
          accessTokenHash: null,
          accessTokenExpiresAt: null,
          services: { create: lines.map((line) => this.lineData(tenantId, line)) },
        },
        include: APPOINTMENT_SUMMARY_INCLUDE,
      });
    });
  }

  /**
   * R80: move an appointment in time and/or to another professional, and change
   * which services it covers.
   *
   * Changing the service list changes the appointment's length and its total,
   * so all three edits go through one path — each of them shifts `end_at`, and
   * every one of them therefore has to re-check the window and rotate the
   * customer's magic link.
   */
  async update(input: UpdateBookingInput): Promise<PrismaAppointmentSummary> {
    const { tenantId } = this.tenantContext.current;
    if ((input.date === undefined) !== (input.time === undefined)) {
      throw new BadRequestException("date and time must be sent together");
    }
    if (input.date === undefined && input.professionalId === undefined && input.serviceIds === undefined) {
      throw new BadRequestException("an update must change the time, the professional, the services, or some of them");
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
        throw new BadRequestException("a cancelled appointment can't be updated");
      }

      const professionalId = input.professionalId ?? existing.professionalId;
      // R120 governs *new* bookings only: an appointment that already exists must
      // stay movable even if its service or its professional was deactivated
      // since — otherwise deactivating a departing stylist would strand every
      // appointment already on their calendar. Passing the current lines as
      // `existing` is what grants that, and it is also what keeps their original
      // prices (R40) when another service is added alongside them. A service
      // being *added* now is a new booking and must be active.
      const lines = await resolveServiceLines(
        tx,
        tenantId,
        input.serviceIds ?? existing.services.map((line) => line.serviceId),
        existing.services,
      );
      // R140 applies to the new pairing just as it does at creation. Moving to
      // another professional still requires that professional to be active.
      await this.assertPairing(tx, tenantId, lines, professionalId, {
        allowInactiveProfessional: professionalId === existing.professionalId,
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
        // Replaced wholesale rather than diffed: `@@unique(appointmentId, position)`
        // is a plain index, so reordering in place collides with itself
        // mid-statement. The snapshots that must survive were already carried
        // over by resolveServiceLines above.
        await tx.appointmentService.deleteMany({ where: { tenantId, appointmentId: existing.id } });
        await tx.appointmentService.createMany({
          data: lines.map((line) => ({ appointmentId: existing.id, ...this.lineData(tenantId, line) })),
        });
      }

      return tx.appointment.update({
        where: { id: existing.id, tenantId },
        data: {
          professionalId,
          startAt,
          endAt,
          // Re-summed from the lines, which is a no-op unless the service list
          // changed: an unchanged service keeps the price it was booked at, so
          // moving an appointment still never re-quotes it (R40).
          price: totalPrice(lines),
          ...this.rotatedToken(existing.accessTokenHash, endAt),
        },
        include: APPOINTMENT_SUMMARY_INCLUDE,
      });
    });
  }

  /** The columns a line is written with; `position` comes from request order. */
  private lineData(tenantId: string, line: ResolvedServiceLine) {
    return {
      tenantId,
      serviceId: line.serviceId,
      position: line.position,
      durationMinutes: line.durationMinutes,
      price: line.price,
    };
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
      // The lines come along because an update needs their snapshots to decide
      // what the appointment still costs and how long it still runs.
      include: { services: { orderBy: { position: "asc" } } },
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
   * R120: a deactivated professional can't take a new booking. R140: they must
   * be paired via ServiceProfessional with *every* service on the appointment,
   * matching `AvailabilityService.resolveCandidates` — a slot is only offered
   * for someone who can do the whole block, so a booking must hold to the same
   * rule or the CMS could submit a pairing the picker never showed.
   *
   * `allowInactiveProfessional` exists for the update path, where the booking
   * already exists: a deactivation since then is a reason not to take *new*
   * bookings, not a reason to freeze the ones on the books.
   */
  private async assertPairing(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lines: readonly ResolvedServiceLine[],
    professionalId: string | null,
    options: { allowInactiveProfessional?: boolean } = {},
  ): Promise<void> {
    if (professionalId === null) {
      return;
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
    // Named rather than counted: "Levan doesn't perform Colour" is something a
    // staff member can act on, "one of these isn't allowed" isn't.
    const missing = lines.find((line) => !performed.has(line.serviceId));
    if (missing) {
      throw new BadRequestException(`${professional.name} doesn't perform "${missing.name}"`);
    }
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
