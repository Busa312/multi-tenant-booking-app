import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import type {
  AvailabilityQuery,
  AvailabilitySlot,
  CreateAppointmentRequest,
  CreateAppointmentResponse,
  Appointment,
  Location,
  ResendMagicLinkRequest,
  RescheduleAppointmentRequest,
  StartVerificationRequest,
  StartVerificationResponse,
  VerifyPhoneRequest,
  VerifyPhoneResponse,
  RescheduleAppointmentResponse,
  Service,
  Professional,
  Tenant,
} from "@booking/shared-types";
import type { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { RedisService } from "../redis/redis.service.js";
import {
  APPOINTMENT_INCLUDE,
  serializeAppointment,
  serializeLocation,
  serializeProfessional,
  serializePublicTenant,
  serializeService,
} from "../common/serializers.js";
import { parseIdList } from "../common/query.js";
import { manageUrl } from "../common/tenant-url.js";
import {
  AppointmentDto,
  AvailabilitySlotDto,
  CreateAppointmentRequestDto,
  CreateAppointmentResponseDto,
  LocationDto,
  ProfessionalDto,
  RescheduleAppointmentRequestDto,
  ResendMagicLinkRequestDto,
  ServiceDto,
  StartVerificationRequestDto,
  StartVerificationResponseDto,
  TenantDto,
  VerifyPhoneRequestDto,
  VerifyPhoneResponseDto,
} from "../common/dto.js";
import { AvailabilityService } from "../booking/availability.service.js";
import { BookingService, hashToken } from "../booking/booking.service.js";
import { NotificationService } from "../notifications/notification.service.js";
import { VerificationService } from "./verification.service.js";

const RESEND_WINDOW_SECONDS = 60 * 60;
const RESEND_MAX_PER_PHONE = 3;
const RESEND_MAX_PER_TENANT = 30;

@ApiTags("public")
@Controller("public")
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly availability: AvailabilityService,
    private readonly booking: BookingService,
    private readonly notifications: NotificationService,
    private readonly redis: RedisService,
    private readonly verification: VerificationService,
  ) {}

  @Get("tenant")
  @ApiOkResponse({ type: TenantDto })
  async getTenant(): Promise<Tenant> {
    const { tenantId } = this.tenantContext.current;
    const tenant = await this.prisma.forTenant((tx) => tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }));

    return serializePublicTenant(tenant);
  }

  @Get("services")
  @ApiOkResponse({ type: [ServiceDto] })
  async listServices(): Promise<Service[]> {
    const { tenantId } = this.tenantContext.current;
    const services = await this.prisma.forTenant((tx) =>
      tx.service.findMany({ where: { tenantId, isActive: true } }),
    );
    return services.map(serializeService);
  }

  @Get("locations")
  @ApiOkResponse({ type: [LocationDto] })
  async listLocations(): Promise<Location[]> {
    const { tenantId } = this.tenantContext.current;
    const locations = await this.prisma.forTenant((tx) =>
      tx.location.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      }),
    );
    return locations.map(serializeLocation);
  }

  @Get("professionals")
  @ApiQuery({ name: "locationId", required: false, description: "R150: only staff who work at that branch" })
  @ApiOkResponse({ type: [ProfessionalDto] })
  async listProfessionals(@Query("locationId") locationId?: string): Promise<Professional[]> {
    const { tenantId } = this.tenantContext.current;

    const professionals = await this.prisma.forTenant((tx) =>
      tx.professional.findMany({
        where: {
          tenantId,
          isActive: true,
          // R180: an OR

          ...(locationId ? { OR: [{ locationId }, { locationId: null }] } : {}),
        },
      }),
    );
    return professionals.map(serializeProfessional);
  }

  @Get("availability")
  @ApiQuery({ name: "serviceIds", description: "Comma-separated service ids" })
  @ApiQuery({ name: "professionalId", required: false })
  @ApiQuery({ name: "locationId", required: false, description: "R150: narrows to that branch's professionals" })
  @ApiQuery({ name: "date", description: "YYYY-MM-DD, in tenant timezone" })
  @ApiOkResponse({ type: [AvailabilitySlotDto] })
  getAvailability(@Query() query: AvailabilityQuery): Promise<AvailabilitySlot[]> {
    const serviceIds = parseIdList(query.serviceIds);

    return this.availability.computeSlots({
      serviceIds,
      professionalId: query.professionalId ?? null,
      locationId: query.locationId ?? null,
      date: query.date,
    });
  }

  /**
   * Sends a one-time code to the number a customer is about to book with.
   *
   * SMS delivery is mocked, so `devCode` carries the code back instead — the
   * same arrangement the magic link and professional invites already use while
   * no provider is wired in. `sendOtp` returning true is what makes that stop.
   */
  @Post("verification/start")
  @ApiBody({ type: StartVerificationRequestDto })
  @ApiOkResponse({ type: StartVerificationResponseDto })
  async startVerification(@Body() body: StartVerificationRequest): Promise<StartVerificationResponse> {
    const { expiresAt, devCode } = await this.verification.start(body.phoneNumber);
    const delivered = devCode
      ? await this.notifications.sendOtp({ phoneNumber: body.phoneNumber, code: devCode })
      : true;

    return { expiresAt: expiresAt.toISOString(), devCode: delivered ? null : devCode };
  }

  @Post("verification/verify")
  @ApiBody({ type: VerifyPhoneRequestDto })
  @ApiOkResponse({ type: VerifyPhoneResponseDto })
  async verifyPhone(@Body() body: VerifyPhoneRequest): Promise<VerifyPhoneResponse> {
    return { verificationToken: await this.verification.verify(body.phoneNumber, body.code) };
  }

  @Post("appointments")
  @ApiBody({ type: CreateAppointmentRequestDto })
  @ApiOkResponse({ type: CreateAppointmentResponseDto })
  async createAppointment(@Body() body: CreateAppointmentRequest): Promise<CreateAppointmentResponse> {
    // R30: optional, exactly as a staff-taken phone booking is. The magic link
    // is minted either way and comes back on the response, so a customer who
    // gives no address still reaches their booking — they just have the link
    // itself as the only copy, and no way to have it re-sent.
    const email = typeof body.email === "string" ? body.email.trim() : "";

    // Consumed before anything is written: the token proves this phone number
    // was verified, is single-use, and is bound to the number being booked —
    // so verifying one number can't authorize a booking under another.
    await this.verification.consume(body.phoneNumber, body.verificationToken);

    const { appointment, magicLinkToken } = await this.booking.create({
      serviceIds: parseIdList(body.serviceIds),
      professionalId: body.professionalId ?? null,
      locationId: body.locationId,
      date: body.date,
      time: body.time,
      userName: body.userName,
      phoneNumber: body.phoneNumber,
      email,
      createdByUserId: null,
      issueMagicLink: true,
    });

    const url = this.buildManageUrl(magicLinkToken);

    if (email) {
      await this.notifications.sendMagicLink({
        email,
        userName: appointment.userName,
        manageUrl: url,
        startAt: appointment.startAt,
        locationName: appointment.location?.name ?? null,
      });
    }

    return {
      appointmentId: appointment.id,
      startAt: appointment.startAt.toISOString(),
      endAt: appointment.endAt.toISOString(),
      manageUrl: url,
    };
  }

  @Get("manage/:token")
  @ApiParam({ name: "token" })
  @ApiOkResponse({ type: AppointmentDto })
  async getAppointmentByToken(@Param("token") token: string): Promise<Appointment> {
    const appointment = await this.prisma.forTenant((tx) => this.findByToken(tx, token));
    return serializeAppointment(appointment);
  }

  /**
   * R80: open times for re-timing one appointment, with that appointment
   * excluded from its own occupancy check.
   *
   * Separate from `GET /public/availability` because the exclusion has to be
   * *authorized*: taking an `appointmentId` on the open endpoint would let
   * anyone suppress an arbitrary booking from the slot list. The token already
   * proves the caller owns this one, so the appointment is derived from it
   * rather than accepted from the query. Its services and professional come
   * from the row too, so the slots offered are the ones the reschedule call
   * will actually accept.
   */
  @Get("manage/:token/availability")
  @ApiParam({ name: "token" })
  @ApiQuery({ name: "date", description: "YYYY-MM-DD, in tenant timezone" })
  @ApiOkResponse({ type: [AvailabilitySlotDto] })
  async getRescheduleAvailability(
    @Param("token") token: string,
    @Query("date") date: string,
  ): Promise<AvailabilitySlot[]> {
    const appointment = await this.prisma.forTenant((tx) => this.findByToken(tx, token));

    return this.availability.computeSlots({
      serviceIds: appointment.services.map((line) => line.serviceId),
      professionalId: appointment.professionalId,
      locationId: appointment.locationId,
      date,
      excludeAppointmentId: appointment.id,
    });
  }

  // R110: rescheduling rotates the token
  @Patch("manage/:token/reschedule")
  @ApiParam({ name: "token" })
  @ApiBody({ type: RescheduleAppointmentRequestDto })
  @ApiOkResponse({ type: AppointmentDto })
  async rescheduleAppointment(
    @Param("token") token: string,
    @Body() body: RescheduleAppointmentRequest,
  ): Promise<RescheduleAppointmentResponse> {
    const existing = await this.prisma.forTenant((tx) => this.findByToken(tx, token));

    const { appointment, magicLinkToken } = await this.booking.update({
      appointmentId: existing.id,
      date: body.date,
      time: body.time,
      professionalScope: null,
    });

    const manageUrl = this.buildManageUrl(magicLinkToken);
    if (magicLinkToken && appointment.email) {
      await this.notifications.sendMagicLink({
        email: appointment.email,
        userName: appointment.userName,
        manageUrl,
        startAt: appointment.startAt,
        locationName: appointment.location?.name ?? null,
      });
    }

    // R110: the token the caller arrived with is dead now, so the replacement
    // goes back in the response as well as by email — the customer must not be
    // locked out of their own booking by the act of moving it.
    return { appointment: serializeAppointment(appointment), manageUrl };
  }

  @Post("manage/:token/cancel")
  @ApiParam({ name: "token" })
  @ApiOkResponse({ type: AppointmentDto })
  async cancelAppointment(@Param("token") token: string): Promise<Appointment> {
    const appointment = await this.prisma.forTenant(async (tx) => {
      const existing = await this.findByToken(tx, token);
      if (existing.status === "cancelled") {
        return existing;
      }

      return tx.appointment.update({
        where: { id: existing.id, tenantId: existing.tenantId },
        data: {
          // R90: the row stays as history
          status: "cancelled",
          accessTokenHash: null,
          accessTokenExpiresAt: null,
        },
        include: APPOINTMENT_INCLUDE,
      });
    });

    return serializeAppointment(appointment);
  }

  @Post("manage/resend")
  @HttpCode(204)
  @ApiBody({ type: ResendMagicLinkRequestDto })
  async resendMagicLink(@Body() body: ResendMagicLinkRequest): Promise<void> {
    const { tenantId } = this.tenantContext.current;
    const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
    if (!phoneNumber) {
      return;
    }
    if (!(await this.withinResendLimits(tenantId, phoneNumber))) {
      return;
    }

    const appointments = await this.prisma.forTenant((tx) =>
      tx.appointment.findMany({
        where: {
          tenantId,
          phoneNumber,
          status: { not: "cancelled" },
          startAt: { gt: new Date() },
          accessTokenHash: { not: null },
          accessTokenExpiresAt: { gt: new Date() },
          // Nothing to re-send to when the customer gave no address (R30).
          email: { not: "" },
        },
        include: { location: { select: { name: true } } },
      }),
    );

    for (const appointment of appointments) {
      const { magicLinkToken } = await this.booking.reissueToken(appointment.id);
      if (!magicLinkToken) {
        continue;
      }
      await this.notifications.sendMagicLink({
        email: appointment.email,
        userName: appointment.userName,
        manageUrl: this.buildManageUrl(magicLinkToken),
        startAt: appointment.startAt,
        locationName: appointment.location?.name ?? null,
      });
    }
  }

  private async findByToken(tx: Prisma.TransactionClient, token: string) {
    const { tenantId } = this.tenantContext.current;
    const appointment =
      typeof token === "string" && token.length > 0
        ? await tx.appointment.findFirst({
            where: { tenantId, accessTokenHash: hashToken(token) },
            include: APPOINTMENT_INCLUDE,
          })
        : null;

    if (!appointment || !appointment.accessTokenExpiresAt || appointment.accessTokenExpiresAt < new Date()) {
      throw new NotFoundException("This link is no longer valid");
    }
    return appointment;
  }

  private buildManageUrl(token: string | null): string {
    const { host, protocol } = this.tenantContext.current;
    return manageUrl(host ?? "", token ?? "", protocol ?? "https");
  }

  /**
   * The per-phone limit is checked first and short-circuits, so a number that is
   * already blocked stops consuming the tenant-wide budget. Incrementing both
   * up front would let one caller hammering a single number exhaust the hourly
   * tenant allowance and lock every other customer out of link recovery.
   *
   * Rotating numbers is still caught: each fresh number passes its own counter
   * and then climbs the tenant one, which is what that counter is for.
   *
   * Redis being down must not take booking recovery offline (system_design.md
   * §8), so a failure here lets the request through rather than blocking it.
   */
  private async withinResendLimits(tenantId: string, phoneNumber: string): Promise<boolean> {
    try {
      if ((await this.bumpCounter(`resend:${tenantId}:${hashToken(phoneNumber)}`)) > RESEND_MAX_PER_PHONE) {
        return false;
      }
      return (await this.bumpCounter(`resend:${tenantId}`)) <= RESEND_MAX_PER_TENANT;
    } catch {
      return true;
    }
  }

  private async bumpCounter(key: string): Promise<number> {
    const count = await this.redis.client.incr(key);
    if (count === 1) {
      await this.redis.client.expire(key, RESEND_WINDOW_SECONDS);
    }
    return count;
  }
}
