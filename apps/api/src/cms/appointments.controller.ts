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

      const range = this.resolveRange(query, timezone);

      return tx.appointment.findMany({
        where: {
          tenantId,
          ...(professionalScope ? { professionalId: professionalScope } : {}),
          ...(range ? { startAt: range } : {}),
        },
        include: APPOINTMENT_SUMMARY_INCLUDE,
        orderBy: { startAt: "asc" },
      });
    });
    return appointments.map(serializeAppointmentSummary);
  }

  // R50: the professional's genuinely open slots
  @Get("availability")
  @ApiQuery({ name: "serviceIds", description: "Comma-separated; durations are summed into one block" })
  @ApiQuery({ name: "professionalId", required: false })
  @ApiQuery({ name: "locationId", required: false, description: "R150: narrows to that branch's professionals" })
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
      // R20: a professional login can only ever ask about their own calendar
      professionalId: professionalScope ?? query.professionalId ?? null,
      locationId: query.locationId ?? null,
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
    // R30: the selector is locked client-side and enforced here

    if (professionalScope && body.professionalId && body.professionalId !== professionalScope) {
      throw new ForbiddenException("professional logins may only book into their own calendar");
    }
    const professionalId = professionalScope ?? body.professionalId ?? null;
    if (professionalId === null) {
      throw new BadRequestException("professionalId is required");
    }

    const { appointment } = await this.booking.create({
      serviceIds: body.serviceIds ?? [],
      professionalId,
      locationId: body.locationId,
      date: body.date,
      time: body.time,
      userName: body.userName,
      phoneNumber: body.phoneNumber,
      email: body.email,
      notes: body.notes,
      createdByUserId: user.sub,
      override: body.override,
    });
    return serializeAppointmentSummary(appointment);
  }

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

    const { appointment } = await this.booking.update({
      appointmentId: id,
      date: body.date,
      time: body.time,
      professionalId: body.professionalId,
      locationId: body.locationId,
      serviceIds: body.serviceIds,
      override: body.override,
      professionalScope,
    });
    return serializeAppointmentSummary(appointment);
  }

  // R100: completed / no_show are set by a person and only by a person
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

  // R90: cancelling only flips the status
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

  private resolveRange(query: CmsAppointmentListQuery, timezone: string): Prisma.DateTimeFilter | null {
    const { from, to } = query;
    if (!from && !to) {
      return null;
    }
    try {
      return {
        ...(from ? { gte: zonedTimeToUtc(from, 0, timezone) } : {}),
        ...(to ? { lt: zonedTimeToUtc(addDaysToDateString(to, 1), 0, timezone) } : {}),
      };
    } catch {
      throw new BadRequestException("from/to must be YYYY-MM-DD calendar dates");
    }
  }
}
