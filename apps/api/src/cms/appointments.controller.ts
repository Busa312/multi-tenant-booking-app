import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import type {
  AppointmentSummary,
  AvailabilitySlot,
  CmsAppointmentListQuery,
  CmsAvailabilityQuery,
  CreateCmsAppointmentRequest,
  JwtClaims,
  UpdateCmsAppointmentRequest,
  UpdateAppointmentStatusRequest,
} from "@booking/shared-types";
import type { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { APPOINTMENT_SUMMARY_INCLUDE, serializeAppointmentSummary } from "../common/serializers.js";
import { addDaysToDateString, zonedTimeToUtc } from "../common/timezone.js";
import { parseIdList } from "../common/query.js";
import {
  AppointmentSummaryDto,
  AvailabilitySlotDto,
  BookingConflictResponseDto,
  CreateCmsAppointmentRequestDto,
  UpdateCmsAppointmentRequestDto,
  UpdateAppointmentStatusRequestDto,
} from "../common/dto.js";
import { AvailabilityService } from "../booking/availability.service.js";
import { BookingService } from "../booking/booking.service.js";

/**
 * Staff-side appointment management: phone bookings, walk-ins, and every change
 * that happens off the public site.
 *
 * R20's scoping is enforced here, not by RLS: RLS scopes rows to a tenant and
 * has no concept of "this professional's own rows", so a `professional` login's
 * own-appointments-only restriction is an application-layer filter on every
 * route below. `owner` acts on any appointment in the tenant (R10).
 */
@ApiTags("cms-appointments")
@ApiBearerAuth()
@Controller("cms/appointments")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly availability: AvailabilityService,
    private readonly booking: BookingService,
  ) {}

  @Get()
  @ApiQuery({ name: "from", required: false, description: "YYYY-MM-DD, inclusive, tenant timezone" })
  @ApiQuery({ name: "to", required: false, description: "YYYY-MM-DD, inclusive, tenant timezone" })
  @ApiOkResponse({ type: [AppointmentSummaryDto] })
  async list(@Query() query: CmsAppointmentListQuery): Promise<AppointmentSummary[]> {
    const { tenantId } = this.tenantContext.current;
    const professionalScope = this.professionalScope();

    const appointments = await this.prisma.forTenant(async (tx) => {
      const { timezone } = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { timezone: true },
      });
      // `from`/`to` are tenant-local calendar days, resolved to instants here so
      // a staff browser in another timezone still gets the salon's own day.
      const range = this.resolveRange(query, timezone);

      return tx.appointment.findMany({
        where: {
          tenantId,
          ...(professionalScope ? { professionalId: professionalScope } : {}),
          ...(range ? { startAt: range } : {}),
        },
        include: APPOINTMENT_SUMMARY_INCLUDE,
        // Cancelled rows stay in the list (R90) — history, not deletions.
        orderBy: { startAt: "asc" },
      });
    });
    return appointments.map(serializeAppointmentSummary);
  }

  /**
   * R50: the professional's genuinely open slots, computed by the same service
   * the public site uses. The CMS shows these as the default path but doesn't
   * enforce them — see R60 and BookingService.
   */
  @Get("availability")
  @ApiQuery({ name: "serviceIds", description: "Comma-separated; durations are summed into one block" })
  @ApiQuery({ name: "professionalId", required: false })
  @ApiQuery({ name: "date", description: "YYYY-MM-DD, tenant timezone" })
  @ApiQuery({
    name: "appointmentId",
    required: false,
    description: "Set when re-timing an existing appointment: excludes it from occupancy (R80)",
  })
  @ApiOkResponse({ type: [AvailabilitySlotDto] })
  getAvailability(@Query() query: CmsAvailabilityQuery): Promise<AvailabilitySlot[]> {
    const serviceIds = parseIdList(query.serviceIds);
    if (serviceIds.length === 0 || !query.date) {
      throw new BadRequestException("serviceIds and date are required");
    }
    const professionalScope = this.professionalScope();
    return this.availability.computeSlots({
      serviceIds,
      // R20: a professional login can only ever ask about their own calendar.
      professionalId: professionalScope ?? query.professionalId ?? null,
      date: query.date,
      excludeAppointmentId: query.appointmentId,
    });
  }

  @Post()
  @ApiBody({ type: CreateCmsAppointmentRequestDto })
  @ApiOkResponse({ type: AppointmentSummaryDto })
  @ApiConflictResponse({ type: BookingConflictResponseDto, description: "Unconfirmed availability conflict (R60)" })
  async create(
    @Body() body: CreateCmsAppointmentRequest,
    @CurrentUser() user: JwtClaims,
  ): Promise<AppointmentSummary> {
    const professionalScope = this.professionalScope();
    // R20/R30: the selector is locked client-side and enforced here. A payload
    // naming someone else is refused rather than quietly rewritten — same answer
    // the reschedule route gives.
    if (professionalScope && body.professionalId && body.professionalId !== professionalScope) {
      throw new ForbiddenException("professional logins may only book into their own calendar");
    }
    const professionalId = professionalScope ?? body.professionalId ?? null;
    if (professionalId === null) {
      throw new BadRequestException("professionalId is required");
    }

    const appointment = await this.booking.create({
      serviceIds: body.serviceIds ?? [],
      professionalId,
      date: body.date,
      time: body.time,
      userName: body.userName,
      phoneNumber: body.phoneNumber,
      email: body.email,
      notes: body.notes,
      // The audit trail for who took the phone call, and what tells this row
      // apart from a customer's own booking.
      createdByUserId: user.sub,
      override: body.override,
    });
    return serializeAppointmentSummary(appointment);
  }

  /**
   * The route keeps its `/reschedule` name for compatibility, but it now edits
   * the service list too — see UpdateCmsAppointmentRequest.
   */
  @Patch(":id/reschedule")
  @ApiParam({ name: "id" })
  @ApiBody({ type: UpdateCmsAppointmentRequestDto })
  @ApiOkResponse({ type: AppointmentSummaryDto })
  @ApiConflictResponse({ type: BookingConflictResponseDto, description: "Unconfirmed availability conflict (R60)" })
  async update(@Param("id") id: string, @Body() body: UpdateCmsAppointmentRequest): Promise<AppointmentSummary> {
    const professionalScope = this.professionalScope();
    if (professionalScope && body.professionalId && body.professionalId !== professionalScope) {
      throw new ForbiddenException("professional logins may only book into their own calendar");
    }

    const appointment = await this.booking.update({
      appointmentId: id,
      date: body.date,
      time: body.time,
      professionalId: body.professionalId,
      serviceIds: body.serviceIds,
      override: body.override,
      professionalScope,
    });
    return serializeAppointmentSummary(appointment);
  }

  /**
   * R100: completed / no_show are set by a person and only by a person. Nothing
   * transitions on its own when an appointment's end time passes — only a staff
   * member can tell a no-show from a late arrival or an unrecorded walk-in.
   */
  @Patch(":id/status")
  @ApiParam({ name: "id" })
  @ApiBody({ type: UpdateAppointmentStatusRequestDto })
  @ApiOkResponse({ type: AppointmentSummaryDto })
  async updateStatus(
    @Param("id") id: string,
    @Body() body: UpdateAppointmentStatusRequest,
  ): Promise<AppointmentSummary> {
    const { tenantId } = this.tenantContext.current;
    const professionalScope = this.professionalScope();
    if (!["booked", "completed", "no_show"].includes(body.status)) {
      throw new BadRequestException("status must be booked, completed or no_show — cancelling has its own endpoint");
    }

    const appointment = await this.prisma.forTenant(async (tx) => {
      const existing = await this.booking.loadOwnAppointment(tx, tenantId, id, professionalScope);
      return tx.appointment.update({
        where: { id: existing.id, tenantId },
        data: { status: body.status },
        include: APPOINTMENT_SUMMARY_INCLUDE,
      });
    });
    return serializeAppointmentSummary(appointment);
  }

  /**
   * R90: cancelling only flips the status. The row stays, stays visible in
   * history, and is never deleted — it also stops blocking availability.
   */
  @Post(":id/cancel")
  @ApiParam({ name: "id" })
  @ApiOkResponse({ type: AppointmentSummaryDto })
  async cancel(@Param("id") id: string): Promise<AppointmentSummary> {
    const { tenantId } = this.tenantContext.current;
    const professionalScope = this.professionalScope();

    const appointment = await this.prisma.forTenant(async (tx) => {
      const existing = await this.booking.loadOwnAppointment(tx, tenantId, id, professionalScope);
      return tx.appointment.update({
        where: { id: existing.id, tenantId },
        data: { status: "cancelled" },
        include: APPOINTMENT_SUMMARY_INCLUDE,
      });
    });
    return serializeAppointmentSummary(appointment);
  }

  /**
   * The professional a `professional` login is confined to (R20), or null for an
   * owner, who sees the whole tenant. A professional whose TenantUser carries no
   * professional_id has no calendar of their own to be confined to, and is
   * rejected rather than silently granted the owner's unscoped view.
   */
  private professionalScope(): string | null {
    const { role, professionalId } = this.tenantContext.current;
    if (role !== "professional") {
      return null;
    }
    if (!professionalId) {
      throw new ForbiddenException("this login isn't linked to a professional record");
    }
    return professionalId;
  }

  /**
   * The instant window for an inclusive span of tenant-local days. Either bound
   * may be omitted, which leaves that side open — `from` alone means "this day
   * onwards", which is what a caller asking for it means.
   */
  private resolveRange(query: CmsAppointmentListQuery, timezone: string): Prisma.DateTimeFilter | null {
    const { from, to } = query;
    if (!from && !to) {
      return null;
    }
    try {
      return {
        ...(from ? { gte: zonedTimeToUtc(from, 0, timezone) } : {}),
        // `to` is an inclusive day, so the exclusive upper bound is the next
        // local midnight.
        ...(to ? { lt: zonedTimeToUtc(addDaysToDateString(to, 1), 0, timezone) } : {}),
      };
    } catch {
      throw new BadRequestException("from/to must be YYYY-MM-DD calendar dates");
    }
  }
}
