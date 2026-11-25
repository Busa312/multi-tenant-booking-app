import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { BookingConflictResponse, VisitPlace, VisitSlot } from "@booking/shared-types";
import type { Prisma } from "../../generated/prisma/index.js";
import { BillingService } from "../billing/billing.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { VISIT_INCLUDE, type PrismaVisit } from "../common/serializers.js";
import { phoneKey } from "../common/phone-key.js";
import { AvailabilityService, type VisitUnitSpec } from "./availability.service.js";
import { BookingService, requireText } from "./booking.service.js";
import { lockBookingDay } from "./booking-lock.js";
import { hashToken, issueToken, linkExpiresAt } from "./magic-link.js";
import { HOLD_MAX_LIVE_PER_TENANT, HOLD_MINUTES } from "./slot-hold.js";
import { resolveServiceLines, totalPrice, type ResolvedServiceLine } from "./service-lines.js";
import { groupPlannedUnits, type PlannedVisit } from "./visit-planner.js";
import {
  assertOfferedAt,
  homeVisitFeeFor,
  parseCustomerAddress,
  parseVisitPlace,
  placeColumns,
  type CustomerAddressInput,
} from "./service-place.js";

export const ANY_PROFESSIONAL = "any";

/** What the customer picked: services, who for each, where and when. */
export interface VisitChoice {
  serviceIds: string[];
  /** R200: aligned with serviceIds — a professional id, or "any". */
  professionalIds: string[];
  // R150: required when the tenant has locations (at the business)
  locationId?: string | null;
  date: string;
  time: string;
  // R630: omitted = at the business
  place?: VisitPlace;
}

export interface CreateVisitInput extends VisitChoice, CustomerAddressInput {
  userName: string;
  phoneNumber: string;
  /** R250: the customer's own hold — it doesn't block them, and is used up by the booking. */
  holdId?: string | null;
}

export interface HoldInput extends VisitChoice {
  /** R250: the customer's previous hold, released by this one. */
  replaceHoldId?: string | null;
}

export interface HoldResult {
  holdId: string;
  expiresAt: Date;
  /** The plan actually held — re-planned now, so it can differ from the one shown. */
  slot: VisitSlot;
}

/** R250: the hold-taking limit was hit; the caller answers 429 and the customer books without one. */
export class HoldLimitError extends Error {}

/** A choice checked and planned at its start time, inside the write's transaction. */
interface PreparedVisit {
  lines: ResolvedServiceLine[];
  units: VisitUnitSpec[];
  locationId: string | null;
  plan: PlannedVisit | null;
  // R630
  place: VisitPlace;
  travelMinutes: number;
  homeVisitFee: Prisma.Decimal | 0;
}

export interface VisitResult {
  visit: PrismaVisit;
  /** The plaintext link token — returned once, never stored (only its hash is). */
  magicLinkToken: string;
}

/**
 * R200–R240: the customer's side of a booking. A visit is one or more ordinary
 * single-professional appointments planned back to back, managed together
 * through one magic link. Staff never go through here: the CMS edits the
 * individual appointments via BookingService, and R20 keeps a professional to
 * their own segment.
 */
@Injectable()
export class VisitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly availability: AvailabilityService,
    private readonly booking: BookingService,
    private readonly billing: BillingService,
  ) {}

  async create(input: CreateVisitInput): Promise<VisitResult> {
    const { tenantId } = this.tenantContext.current;
    const userName = requireText(input.userName, "userName");
    const phoneNumber = requireText(input.phoneNumber, "phoneNumber");
    const holdId = input.holdId ?? null;
    // R630: checked before anything else, so a missing address isn't "slot gone"
    const address = parseCustomerAddress(parseVisitPlace(input.place), input);

    return this.prisma.forTenant(async (tx) => {
      // Re-planned inside the write's transaction, behind the day's lock (R260):
      // the slot the customer picked may have gone since they saw it — even
      // with a hold, which may have expired while they verified their phone.
      const { lines, locationId, plan, place, travelMinutes, homeVisitFee } = await this.prepare(tx, input, holdId);
      if (!plan) {
        throw this.slotGone();
      }

      const issued = issueToken(new Date(plan.end));
      const visit = await tx.visit.create({
        data: { tenantId, accessTokenHash: issued.accessTokenHash, accessTokenExpiresAt: issued.accessTokenExpiresAt },
      });

      // R200: one appointment per professional segment
      for (const [groupIndex, group] of groupPlannedUnits(plan.units).entries()) {
        const groupLines = group.unitIndexes
          .map((index) => lines[index])
          .filter((line): line is ResolvedServiceLine => line !== undefined);
        await tx.appointment.create({
          data: {
            tenantId,
            visitId: visit.id,
            professionalId: group.professionalId,
            // R150: recorded so the confirmation and the link can say where
            locationId,
            userName,
            phoneNumber,
            phoneKey: phoneKey(phoneNumber),
            // R270: no longer collected; the column stays for older bookings
            email: "",
            startAt: new Date(group.start),
            endAt: new Date(group.end),
            // R40: snapshots — a later price change must not rewrite history
            price: totalPrice(groupLines),
            // R630: where, and the travel kept free around it; the fee once, on the first segment
            ...placeColumns(place, address, travelMinutes),
            homeVisitFee: groupIndex === 0 ? homeVisitFee : 0,
            createdByUserId: null,
            services: {
              create: groupLines.map((line, position) => ({
                tenantId,
                serviceId: line.serviceId,
                position,
                durationMinutes: line.durationMinutes,
                price: line.price,
                priceFrom: line.priceFrom,
              })),
            },
          },
        });
      }

      // R250: the hold has become the booking
      if (holdId) {
        await tx.slotHold.deleteMany({ where: { tenantId, holdId } });
      }

      return {
        visit: await tx.visit.findUniqueOrThrow({ where: { id: visit.id }, include: VISIT_INCLUDE }),
        magicLinkToken: issued.token,
      };
    });
  }

  /**
   * R250: holds the professionals of the visit planned at the picked time for
   * HOLD_MINUTES, so nobody else is offered it or can book it while this
   * customer finishes. Replaces their previous hold.
   *
   * Throws the usual 409 when the time is gone — but the previous hold is
   * released either way: the customer has moved on from it, and leaving it to
   * expire would block that time for everyone else for nothing.
   */
  async hold(input: HoldInput): Promise<HoldResult> {
    const { tenantId } = this.tenantContext.current;
    const replaceHoldId = input.replaceHoldId ?? null;

    const outcome = await this.prisma.forTenant(async (tx) => {
      const now = new Date();
      if (replaceHoldId) {
        await tx.slotHold.deleteMany({ where: { tenantId, holdId: replaceHoldId } });
      }

      const { units, plan, travelMinutes } = await this.prepare(tx, input, null);
      const slot = plan ? AvailabilityService.toVisitSlots([plan], units)[0] : undefined;
      if (!plan || !slot) {
        return null;
      }

      // Expired rows are already ignored everywhere; this just keeps the table small.
      await tx.slotHold.deleteMany({ where: { tenantId, expiresAt: { lte: now } } });
      const live = await tx.slotHold.groupBy({ by: ["holdId"], where: { tenantId, expiresAt: { gt: now } } });
      if (live.length >= HOLD_MAX_LIVE_PER_TENANT) {
        return "limit" as const;
      }

      const holdId = randomUUID();
      const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000);
      await tx.slotHold.createMany({
        data: groupPlannedUnits(plan.units).map((group) => ({
          tenantId,
          holdId,
          // R240: a public plan never has an unassigned segment
          professionalId: group.professionalId,
          startAt: new Date(group.start),
          endAt: new Date(group.end),
          // R630: a held home visit keeps its travel time free too
          travelMinutes,
          expiresAt,
        })),
      });

      return { holdId, expiresAt, slot };
    });

    if (outcome === null) {
      throw this.slotGone();
    }
    if (outcome === "limit") {
      throw new HoldLimitError("too many live holds for this tenant");
    }
    return outcome;
  }

  /** R250: the customer let go of the time (went back, changed their mind). Idempotent. */
  async release(holdId: string): Promise<void> {
    const { tenantId } = this.tenantContext.current;
    await this.prisma.forTenant((tx) => tx.slotHold.deleteMany({ where: { tenantId, holdId } }));
  }

  async getByToken(token: string): Promise<PrismaVisit> {
    return this.prisma.forTenant((tx) => this.findByTokenIn(tx, token));
  }

  /** R80/R230: start times for moving the whole visit, with itself excluded. */
  async rescheduleSlots(token: string, date: string): Promise<VisitSlot[]> {
    return this.prisma.forTenant(async (tx) => {
      const visit = await this.findByTokenIn(tx, token);
      this.assertChangeable(visit, (await this.tenantRules(tx)).changeCutoffHours);
      const { units, locationId, place, travelMinutes } = this.existingUnits(visit);
      if (units.length === 0) {
        return [];
      }
      const plans = await this.availability.visitPlansIn(tx, {
        units,
        locationId,
        date,
        excludeVisitId: visit.id,
        keepExistingPairings: true,
        // R630: a home visit keeps the travel time it was booked with
        place,
        travelMinutes,
      });
      return AvailabilityService.toVisitSlots(plans, units);
    });
  }

  /**
   * R230: the whole visit moves to a new start, each segment keeping its
   * professional. The link stays the same; only its expiry follows the new end.
   */
  async reschedule(token: string, date: string, time: string): Promise<PrismaVisit> {
    const { tenantId } = this.tenantContext.current;

    return this.prisma.forTenant(async (tx) => {
      const visit = await this.findByTokenIn(tx, token);
      // One read for both the cutoff and the clock.
      const { timezone, changeCutoffHours } = await this.tenantRules(tx);
      this.assertChangeable(visit, changeCutoffHours);
      const { units, appointments, locationId, place, travelMinutes } = this.existingUnits(visit);
      if (units.length === 0) {
        throw new BadRequestException("a cancelled booking can't be rescheduled");
      }

      const startAt = this.booking.resolveStartAt(date, time, timezone);
      // R260: checked behind the day's lock
      await lockBookingDay(tx, tenantId, date);
      const plan: PlannedVisit | null = await this.availability.visitPlanAtIn(
        tx,
        { units, locationId, date, excludeVisitId: visit.id, keepExistingPairings: true, place, travelMinutes },
        startAt,
      );
      if (!plan) {
        throw this.slotGone();
      }

      for (const planned of plan.units) {
        const appointment = appointments[planned.unitIndex];
        if (!appointment) continue;
        await tx.appointment.update({
          where: { id: appointment.id, tenantId },
          data: {
            startAt: new Date(planned.start),
            endAt: new Date(planned.end),
            professionalId: planned.professionalId,
            // R610: a new time gets its own reminder, and needs confirming again
            reminderSentAt: null,
            confirmedAt: null,
          },
        });
      }

      return tx.visit.update({
        where: { id: visit.id, tenantId },
        data: { accessTokenExpiresAt: linkExpiresAt(new Date(plan.end)) },
        include: VISIT_INCLUDE,
      });
    });
  }

  /**
   * R230: the customer cancels the whole visit. R90: rows stay as history —
   * only still-booked segments flip, so a segment staff already marked
   * completed or no-show keeps that record. The link dies with it.
   */
  async cancel(token: string): Promise<{ visit: PrismaVisit; cancelled: boolean }> {
    const { tenantId } = this.tenantContext.current;

    return this.prisma.forTenant(async (tx) => {
      const visit = await this.findByTokenIn(tx, token);
      if (!visit.appointments.some((appointment) => appointment.status === "booked")) {
        return { visit, cancelled: false };
      }
      this.assertChangeable(visit, (await this.tenantRules(tx)).changeCutoffHours);
      await tx.appointment.updateMany({
        where: { tenantId, visitId: visit.id, status: "booked" },
        data: { status: "cancelled" },
      });
      const updated = await tx.visit.update({
        where: { id: visit.id, tenantId },
        data: { accessTokenHash: null, accessTokenExpiresAt: null },
        include: VISIT_INCLUDE,
      });
      return { visit: updated, cancelled: true };
    });
  }

  /**
   * R610: the customer says they're coming. Any time before the start — the
   * change deadline (R300) is about changing, not confirming. Marks every
   * still-booked segment; confirming twice changes nothing.
   */
  async confirm(token: string): Promise<PrismaVisit> {
    const { tenantId } = this.tenantContext.current;
    const now = new Date();

    return this.prisma.forTenant(async (tx) => {
      const visit = await this.findByTokenIn(tx, token);
      const booked = visit.appointments.filter((appointment) => appointment.status === "booked");
      if (booked.length === 0) {
        throw new BadRequestException("only a booked visit can be confirmed");
      }
      if (booked.every((appointment) => appointment.startAt <= now)) {
        throw new BadRequestException("this visit has already started");
      }
      await tx.appointment.updateMany({
        where: { tenantId, visitId: visit.id, status: "booked", confirmedAt: null },
        data: { confirmedAt: now },
      });
      return tx.visit.findFirstOrThrow({ where: { id: visit.id, tenantId }, include: VISIT_INCLUDE });
    });
  }

  /**
   * Visits a lost-link request may re-send: a live link, and at least one
   * upcoming, uncancelled segment booked under this phone number — which is
   * where the fresh link is texted (R270).
   */
  async findResendable(phoneNumber: string): Promise<PrismaVisit[]> {
    const { tenantId } = this.tenantContext.current;
    const now = new Date();
    return this.prisma.forTenant((tx) =>
      tx.visit.findMany({
        where: {
          tenantId,
          accessTokenHash: { not: null },
          accessTokenExpiresAt: { gt: now },
          appointments: {
            // Matched on the canonical number, however it was typed then or now
            some: { phoneKey: phoneKey(phoneNumber), status: { not: "cancelled" }, startAt: { gt: now } },
          },
        },
        include: VISIT_INCLUDE,
      }),
    );
  }

  /** A fresh link for a visit that still has one — the old link can't be recovered, only replaced. */
  async reissue(visitId: string): Promise<string | null> {
    const { tenantId } = this.tenantContext.current;
    return this.prisma.forTenant((tx) => this.booking.rotateVisitToken(tx, tenantId, visitId));
  }

  async findByTokenIn(tx: Prisma.TransactionClient, token: string): Promise<PrismaVisit> {
    const { tenantId } = this.tenantContext.current;
    const visit =
      typeof token === "string" && token.length > 0
        ? await tx.visit.findFirst({
            // Looked up by hash: the plaintext never touches the database.
            where: { tenantId, accessTokenHash: hashToken(token) },
            include: VISIT_INCLUDE,
          })
        : null;

    if (!visit || !visit.accessTokenExpiresAt || visit.accessTokenExpiresAt < new Date()) {
      throw new NotFoundException("This link is no longer valid");
    }
    return visit;
  }

  /**
   * Validates a customer's choice and plans it at the picked start time. Takes
   * the day's lock (R260) before planning, so whatever the caller writes next
   * can't race another booking or hold for the same day.
   */
  private async prepare(
    tx: Prisma.TransactionClient,
    input: VisitChoice,
    excludeHoldId: string | null,
  ): Promise<PreparedVisit> {
    const { tenantId } = this.tenantContext.current;
    const { timezone, customersChooseProfessional, travelBufferMinutes, homeVisitFee } = await tx.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { timezone: true, customersChooseProfessional: true, travelBufferMinutes: true, homeVisitFee: true },
    });
    // R630: one visit, one place
    const place = parseVisitPlace(input.place);
    // R490: a lapsed salon's booking site takes no new holds or bookings
    await this.billing.assertBookableIn(tx, tenantId);

    // R120 + R210: active services only, one to five, no duplicates
    const lines = await resolveServiceLines(tx, tenantId, input.serviceIds);
    assertOfferedAt(lines, place);
    if (!Array.isArray(input.professionalIds) || input.professionalIds.length !== lines.length) {
      throw new BadRequestException("professionalIds must have one entry per service");
    }
    // R440: a business that turned the choice off books every segment as "any"
    // (assigned by R450), whatever a caller sends — not just what its site shows.
    const chosen = input.professionalIds.map((id) =>
      !customersChooseProfessional || id === ANY_PROFESSIONAL || id === "" ? null : id,
    );

    // R630: a visit at the customer's address has no branch
    if (place === "customer" && input.locationId) {
      throw new BadRequestException("a visit at the customer's address has no location");
    }
    const locationId = place === "customer" ? null : await this.booking.resolveLocation(tx, tenantId, input.locationId, null);
    const travelMinutes = place === "customer" ? travelBufferMinutes : 0;
    await this.assertChoices(tx, tenantId, lines, chosen, locationId);
    const startAt = this.booking.resolveStartAt(input.date, input.time, timezone);

    const units: VisitUnitSpec[] = lines.map((line, index) => ({
      durationMinutes: line.durationMinutes,
      serviceIds: [line.serviceId],
      professionalId: chosen[index] ?? null,
    }));

    await lockBookingDay(tx, tenantId, input.date);
    const plan = await this.availability.visitPlanAtIn(
      tx,
      { units, locationId, date: input.date, excludeHoldId, place, travelMinutes },
      startAt,
    );
    return {
      lines,
      units,
      locationId,
      plan,
      place,
      travelMinutes,
      homeVisitFee: homeVisitFeeFor(place, lines, homeVisitFee),
    };
  }

  /** Each live segment as one planner unit with its professional fixed (R230: who stays the same). */
  private existingUnits(visit: PrismaVisit) {
    const appointments = visit.appointments.filter((appointment) => appointment.status !== "cancelled");
    const units: VisitUnitSpec[] = appointments.map((appointment) => ({
      durationMinutes: Math.round((appointment.endAt.getTime() - appointment.startAt.getTime()) / 60_000),
      serviceIds: appointment.services.map((line) => line.serviceId),
      professionalId: appointment.professionalId,
    }));
    // R630: a move keeps the place and the travel time it was booked with
    const first = appointments[0];
    return {
      units,
      appointments,
      locationId: first?.locationId ?? null,
      place: (first?.place === "customer" ? "customer" : "business") as VisitPlace,
      travelMinutes: first?.travelMinutes ?? 0,
    };
  }

  /**
   * Explicitly chosen professionals get specific errors here rather than a
   * vague "no time available": they must exist, be active, work at the branch
   * (R180) and perform the service they were picked for.
   */
  private async assertChoices(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lines: readonly ResolvedServiceLine[],
    chosen: readonly (string | null)[],
    locationId: string | null,
  ): Promise<void> {
    const ids = [...new Set(chosen.filter((id): id is string => id !== null))];
    if (ids.length === 0) return;

    const [professionals, assignments] = await Promise.all([
      tx.professional.findMany({ where: { tenantId, id: { in: ids } } }),
      tx.serviceProfessional.findMany({
        where: { tenantId, professionalId: { in: ids } },
        select: { professionalId: true, serviceId: true },
      }),
    ]);

    lines.forEach((line, index) => {
      const id = chosen[index];
      if (!id) return;
      const professional = professionals.find((candidate) => candidate.id === id);
      if (!professional) {
        throw new NotFoundException("Professional not found");
      }
      if (!professional.isActive) {
        throw new BadRequestException(`${professional.name} is deactivated and can't take new bookings`);
      }
      if (locationId && professional.locationId !== null && professional.locationId !== locationId) {
        throw new BadRequestException(`${professional.name} doesn't work at that location`);
      }
      if (!assignments.some((a) => a.professionalId === id && a.serviceId === line.serviceId)) {
        throw new BadRequestException(`${professional.name} doesn't perform "${line.name}"`);
      }
    });
  }

  /**
   * R300: a customer may change or cancel online only until the salon's cutoff
   * before the visit starts (at the latest, its start). After that the salon
   * has to be asked — staff in the CMS aren't bound by this.
   */
  private assertChangeable(visit: PrismaVisit, changeCutoffHours: number): void {
    const live = visit.appointments.filter((appointment) => appointment.status !== "cancelled");
    const first = live[0];
    if (!first) return;
    if (Date.now() >= first.startAt.getTime() - changeCutoffHours * 3_600_000) {
      throw new ForbiddenException({
        code: "change_cutoff",
        message: "This booking can no longer be changed online. Please contact the salon.",
      });
    }
  }

  private tenantRules(tx: Prisma.TransactionClient): Promise<{ timezone: string; changeCutoffHours: number }> {
    const { tenantId } = this.tenantContext.current;
    return tx.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { timezone: true, changeCutoffHours: true },
    });
  }

  /** 409 in the shape the booking flow already maps to "that time was just taken". */
  private slotGone(): ConflictException {
    // R360: the customer's record is for staff — the public flow never carries it
    const body: BookingConflictResponse = { code: "booking_conflict", conflicts: [], noShowHistory: null };
    return new ConflictException(body);
  }
}
