import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, ServiceUnavailableException } from "@nestjs/common";
import { ApiBody, ApiForbiddenResponse, ApiOkResponse, ApiParam, ApiQuery, ApiTags, ApiTooManyRequestsResponse } from "@nestjs/swagger";
import type {
  AvailabilityQuery,
  CreateAppointmentRequest,
  CreateAppointmentResponse,
  HoldSlotRequest,
  HoldSlotResponse,
  Location,
  ResendMagicLinkRequest,
  RescheduleAppointmentRequest,
  StartVerificationRequest,
  StartVerificationResponse,
  VerifyPhoneRequest,
  VerifyPhoneResponse,
  Service,
  PublicProfessional,
  Tenant,
  Visit,
  VisitSlot,
  OpeningHours,
} from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { RateLimitService } from "../rate-limit/rate-limit.service.js";
import { RateLimit } from "../rate-limit/rate-limit.decorator.js";
import { tooManyRequests } from "../rate-limit/rate-limit.guard.js";
import {
  serializeLocation,
  serializePublicProfessional,
  serializePublicTenant,
  serializeService,
  serializeVisit,
  type PrismaVisit,
} from "../common/serializers.js";
import { parseIdList } from "../common/query.js";
import { manageUrl } from "../common/tenant-url.js";
import {
  CreateAppointmentRequestDto,
  CreateAppointmentResponseDto,
  HoldSlotRequestDto,
  HoldSlotResponseDto,
  LocationDto,
  PublicProfessionalDto,
  RescheduleAppointmentRequestDto,
  ResendMagicLinkRequestDto,
  ServiceDto,
  StartVerificationRequestDto,
  OpeningHoursDto,
  OtpCooldownResponseDto,
  PhoneBlockedResponseDto,
  StartVerificationResponseDto,
  TenantDto,
  VerifyPhoneRequestDto,
  VerifyPhoneResponseDto,
  VisitDto,
  VisitSlotDto,
} from "../common/dto.js";
import { AvailabilityService } from "../booking/availability.service.js";
import { hashToken } from "../booking/magic-link.js";
import { ANY_PROFESSIONAL, HoldLimitError, VisitService } from "../booking/visit.service.js";
import { HOLD_MAX_PER_VISITOR, HOLD_VISITOR_WINDOW_SECONDS, parseHoldId } from "../booking/slot-hold.js";

// R330: per client address. Generous for a person, tight for a script.
const LIMIT_READ = { max: 120, windowSeconds: 60 };
import { NotificationService } from "../notifications/notification.service.js";
import { VerificationService } from "./verification.service.js";
import { BlockedPhoneService } from "../booking/blocked-phone.service.js";
import { phoneKey } from "../common/phone-key.js";
import { openingHours } from "../booking/working-hours.js";
import { BillingService } from "../billing/billing.service.js";

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
    private readonly visits: VisitService,
    private readonly notifications: NotificationService,
    private readonly limits: RateLimitService,
    private readonly verification: VerificationService,
    private readonly blockedPhones: BlockedPhoneService,
    private readonly billing: BillingService,
  ) {}

  @Get("tenant")
  @ApiOkResponse({ type: TenantDto })
  async getTenant(): Promise<Tenant> {
    const { tenantId } = this.tenantContext.current;
    const { tenant, bookingPaused } = await this.prisma.forTenant(async (tx) => ({
      tenant: await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      // R490
      bookingPaused: await this.billing.bookingPausedIn(tx, tenantId),
    }));

    return { ...serializePublicTenant(tenant), bookingPaused };
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

  // R390: when the salon is open, for the home page
  @Get("hours")
  @ApiOkResponse({ type: [OpeningHoursDto] })
  async listOpeningHours(): Promise<OpeningHours[]> {
    const { tenantId } = this.tenantContext.current;
    return this.prisma.forTenant(async (tx) => {
      const [rows, professionals] = await Promise.all([
        tx.businessHours.findMany({
          where: { tenantId },
          select: { professionalId: true, dayOfWeek: true, startTime: true, endTime: true, isDayOff: true },
        }),
        tx.professional.findMany({ where: { tenantId, isActive: true }, select: { id: true } }),
      ]);
      return openingHours(
        rows,
        professionals.map((professional) => professional.id),
      );
    });
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
  @ApiOkResponse({ type: [PublicProfessionalDto] })
  async listProfessionals(@Query("locationId") locationId?: string): Promise<PublicProfessional[]> {
    const { tenantId } = this.tenantContext.current;

    const professionals = await this.prisma.forTenant((tx) =>
      tx.professional.findMany({
        where: {
          tenantId,
          isActive: true,
          // R180: an OR

          ...(locationId ? { OR: [{ locationId }, { locationId: null }] } : {}),
        },
        // R240: so the booking flow can offer only qualified people per service
        include: { serviceProfessionals: { select: { serviceId: true } } },
      }),
    );
    return professionals.map(serializePublicProfessional);
  }

  /**
   * R200: start times at which the whole visit fits, each with its plan — who
   * performs which services, when. R240: never an unassigned segment; a service
   * nobody can perform yields no slots at all.
   */
  @Get("availability")
  @ApiQuery({ name: "serviceIds", description: "Comma-separated service ids, in order (R210: at most 5)" })
  @ApiQuery({
    name: "professionalIds",
    required: false,
    description: 'Comma-separated, aligned with serviceIds: a professional id or "any". Omitted = any for every service',
  })
  @ApiQuery({ name: "locationId", required: false, description: "R150: narrows to that branch's professionals" })
  @ApiQuery({ name: "date", description: "YYYY-MM-DD, in tenant timezone" })
  @ApiQuery({ name: "holdId", required: false, description: "R250: the asker's own hold, so its time stays listed" })
  @ApiOkResponse({ type: [VisitSlotDto] })
  // R330: the planner is the most expensive thing an anonymous caller can run
  @RateLimit({ name: "availability", ...LIMIT_READ })
  getAvailability(@Query() query: AvailabilityQuery): Promise<VisitSlot[]> {
    const serviceIds = parseIdList(query.serviceIds);
    // Parsed by hand rather than with parseIdList: positions matter here, so
    // nothing may be dropped or reordered.
    const raw = query.professionalIds as unknown;
    const professionalIds =
      typeof raw === "string" && raw.length > 0
        ? raw.split(",").map((id) => {
            const trimmed = id.trim();
            return trimmed === ANY_PROFESSIONAL || trimmed === "" ? null : trimmed;
          })
        : serviceIds.map(() => null);

    return this.availability.computeVisitSlots({
      serviceIds,
      professionalIds,
      locationId: query.locationId ?? null,
      date: query.date,
      holdId: parseHoldId(query.holdId),
    });
  }

  /**
   * R250: holds the time a customer just picked for a few minutes, so nobody
   * else is offered or can book it while they enter their details and verify
   * their phone. 409 = someone got there first (the site shows fresh times);
   * 429 = a hold limit was hit, and the customer simply carries on without one.
   */
  @Post("holds")
  @RateLimit({ name: "hold", max: HOLD_MAX_PER_VISITOR, windowSeconds: HOLD_VISITOR_WINDOW_SECONDS })
  @ApiBody({ type: HoldSlotRequestDto })
  @ApiOkResponse({ type: HoldSlotResponseDto })
  async holdSlot(@Body() body: HoldSlotRequest): Promise<HoldSlotResponse> {
    try {
      const { holdId, expiresAt, slot } = await this.visits.hold({
        serviceIds: parseIdList(body.serviceIds),
        professionalIds: Array.isArray(body.professionalIds) ? body.professionalIds : [],
        locationId: body.locationId,
        date: body.date,
        time: body.time,
        replaceHoldId: parseHoldId(body.replaceHoldId),
      });
      return { holdId, expiresAt: expiresAt.toISOString(), slot };
    } catch (error) {
      if (error instanceof HoldLimitError) {
        throw tooManyRequests(HOLD_VISITOR_WINDOW_SECONDS);
      }
      throw error;
    }
  }

  // R250: the customer let go of the time. Always 204 — an unknown or expired
  // hold is already released.
  @Delete("holds/:holdId")
  @HttpCode(204)
  @RateLimit({ name: "hold-release", ...LIMIT_READ })
  @ApiParam({ name: "holdId" })
  async releaseHold(@Param("holdId") holdId: string): Promise<void> {
    const id = parseHoldId(holdId);
    if (id) {
      await this.visits.release(id);
    }
  }

  /**
   * Sends a one-time code to the number a customer is about to book with.
   *
   * While no SMS provider is configured, `devCode` carries the code back
   * instead — the same arrangement the magic link and professional invites use.
   * Once one is, the code only ever travels by SMS: a failed send is an error,
   * never a reason to show the code to whoever asked for it. One code per
   * number per minute (429 `otp_cooldown` otherwise; the last code still works).
   */
  @Post("verification/start")
  // R330: per address, on top of the per-phone and per-tenant limits inside
  @RateLimit({ name: "otp-start", max: 10, windowSeconds: 60 * 60 })
  @ApiBody({ type: StartVerificationRequestDto })
  @ApiOkResponse({ type: StartVerificationResponseDto })
  @ApiTooManyRequestsResponse({ type: OtpCooldownResponseDto })
  @ApiForbiddenResponse({ type: PhoneBlockedResponseDto, description: "R380: this salon doesn't take online bookings from the number" })
  async startVerification(@Body() body: StartVerificationRequest): Promise<StartVerificationResponse> {
    // R380: checked before a code is sent — a blocked number costs the salon no SMS
    await this.blockedPhones.assertNotBlocked(body.phoneNumber);
    const { expiresAt, devCode } = await this.verification.start(body.phoneNumber);
    if (!this.notifications.canDeliverSms()) {
      return { expiresAt: expiresAt.toISOString(), devCode };
    }
    if (devCode && !(await this.notifications.sendOtp({ phoneNumber: body.phoneNumber, code: devCode }))) {
      throw new ServiceUnavailableException("We couldn't text the code. Check the number and try again.");
    }
    return { expiresAt: expiresAt.toISOString(), devCode: null };
  }

  @Post("verification/verify")
  @RateLimit({ name: "otp-verify", max: 30, windowSeconds: 10 * 60 })
  @ApiBody({ type: VerifyPhoneRequestDto })
  @ApiOkResponse({ type: VerifyPhoneResponseDto })
  async verifyPhone(@Body() body: VerifyPhoneRequest): Promise<VerifyPhoneResponse> {
    return { verificationToken: await this.verification.verify(body.phoneNumber, body.code) };
  }

  @Post("appointments")
  @RateLimit({ name: "book", max: 20, windowSeconds: 60 * 60 })
  @ApiBody({ type: CreateAppointmentRequestDto })
  @ApiOkResponse({ type: CreateAppointmentResponseDto })
  async createAppointment(@Body() body: CreateAppointmentRequest): Promise<CreateAppointmentResponse> {
    // R380: again here, in case the number was blocked after its code went out
    await this.blockedPhones.assertNotBlocked(body.phoneNumber);
    // Consumed before anything is written: the token proves this phone number
    // was verified, is single-use, and is bound to the number being booked —
    // so verifying one number can't authorize a booking under another.
    await this.verification.consume(body.phoneNumber, body.verificationToken);

    // R270: no email — the link goes to the verified phone, and comes back on
    // the response either way so the confirmation screen can show it.
    const { visit, magicLinkToken } = await this.visits.create({
      serviceIds: parseIdList(body.serviceIds),
      professionalIds: Array.isArray(body.professionalIds) ? body.professionalIds : [],
      locationId: body.locationId,
      date: body.date,
      time: body.time,
      userName: body.userName,
      phoneNumber: body.phoneNumber,
      holdId: parseHoldId(body.holdId),
    });

    const url = this.buildManageUrl(magicLinkToken);
    const linkTexted = await this.sendLink(visit, url);
    return { visit: serializeVisit(visit), manageUrl: url, linkTexted };
  }

  @Get("manage/:token")
  @RateLimit({ name: "manage-read", ...LIMIT_READ })
  @ApiParam({ name: "token" })
  @ApiOkResponse({ type: VisitDto })
  async getAppointmentByToken(@Param("token") token: string): Promise<Visit> {
    return serializeVisit(await this.visits.getByToken(token));
  }

  /**
   * R80/R230: start times for moving the whole visit, with the visit excluded
   * from its own occupancy check and each segment keeping its professional.
   *
   * Separate from `GET /public/availability` because the exclusion has to be
   * *authorized*: taking a visit id on the open endpoint would let anyone
   * suppress an arbitrary booking from the slot list. The token proves the
   * caller owns this one, so the visit is derived from it.
   */
  @Get("manage/:token/availability")
  @RateLimit({ name: "manage-read", ...LIMIT_READ })
  @ApiParam({ name: "token" })
  @ApiQuery({ name: "date", description: "YYYY-MM-DD, in tenant timezone" })
  @ApiOkResponse({ type: [VisitSlotDto] })
  getRescheduleAvailability(@Param("token") token: string, @Query("date") date: string): Promise<VisitSlot[]> {
    return this.visits.rescheduleSlots(token, date);
  }

  // R230: the whole visit moves. The link stays the same (only its expiry
  // follows the new end), so nothing is texted — the one they have still works.
  @Patch("manage/:token/reschedule")
  @RateLimit({ name: "manage-write", max: 30, windowSeconds: 60 * 60 })
  @ApiParam({ name: "token" })
  @ApiBody({ type: RescheduleAppointmentRequestDto })
  @ApiOkResponse({ type: VisitDto })
  async rescheduleAppointment(@Param("token") token: string, @Body() body: RescheduleAppointmentRequest): Promise<Visit> {
    return serializeVisit(await this.visits.reschedule(token, body.date, body.time));
  }

  // R230: the customer cancels the whole visit; R90: rows stay as history
  @Post("manage/:token/cancel")
  @RateLimit({ name: "manage-write", max: 30, windowSeconds: 60 * 60 })
  @ApiParam({ name: "token" })
  @ApiOkResponse({ type: VisitDto })
  async cancelAppointment(@Param("token") token: string): Promise<Visit> {
    return serializeVisit(await this.visits.cancel(token));
  }

  @Post("manage/resend")
  @HttpCode(204)
  @RateLimit({ name: "resend", max: 10, windowSeconds: 60 * 60 })
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

    // R270: texted to the number asked about — never shown to the caller, who
    // hasn't proved they own it. Re-sending *replaces* each link, so while
    // texts can't be delivered it must do nothing at all: otherwise anyone
    // knowing a customer's number could kill the only link they have.
    if (!this.notifications.canDeliverSms()) {
      return;
    }
    const visits = await this.visits.findResendable(phoneNumber);
    for (const visit of visits) {
      const magicLinkToken = await this.visits.reissue(visit.id);
      if (!magicLinkToken) {
        continue;
      }
      await this.sendLink(visit, this.buildManageUrl(magicLinkToken));
    }
  }

  /** R270: the link, by SMS to the visit's verified phone. True when actually delivered. */
  private async sendLink(visit: PrismaVisit, manageUrl: string): Promise<boolean> {
    const live = visit.appointments.filter((appointment) => appointment.status !== "cancelled");
    const first = live[0] ?? visit.appointments[0];
    if (!first) return false;
    return this.notifications.sendMagicLink({
      phoneNumber: first.phoneNumber,
      userName: first.userName,
      manageUrl,
      startAt: first.startAt,
      locationName: first.location?.name ?? null,
    });
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
   * Fails open (RateLimitService) — Redis being down must not take booking
   * recovery offline.
   */
  private async withinResendLimits(tenantId: string, phoneNumber: string): Promise<boolean> {
    const perPhone = await this.limits.hit(
      `resend:${tenantId}:${hashToken(phoneKey(phoneNumber))}`,
      RESEND_MAX_PER_PHONE,
      RESEND_WINDOW_SECONDS,
    );
    if (!perPhone.allowed) return false;
    return (await this.limits.hit(`resend:${tenantId}`, RESEND_MAX_PER_TENANT, RESEND_WINDOW_SECONDS)).allowed;
  }
}
