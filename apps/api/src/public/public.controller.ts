import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ApiBody, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
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
  RescheduleAppointmentResponse,
  Service,
  PublicProfessional,
  Tenant,
  Visit,
  VisitSlot,
} from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { RedisService } from "../redis/redis.service.js";
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
  RescheduleVisitResponseDto,
  ResendMagicLinkRequestDto,
  ServiceDto,
  StartVerificationRequestDto,
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
    private readonly visits: VisitService,
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
  @ApiBody({ type: HoldSlotRequestDto })
  @ApiOkResponse({ type: HoldSlotResponseDto })
  async holdSlot(
    @Body() body: HoldSlotRequest,
    @Headers("x-forwarded-for") forwardedFor: string | undefined,
    @Req() req: FastifyRequest,
  ): Promise<HoldSlotResponse> {
    const { tenantId } = this.tenantContext.current;
    if (!(await this.withinHoldLimit(tenantId, visitorIp(forwardedFor, req.ip)))) {
      throw new HttpException({ code: "hold_limit" }, HttpStatus.TOO_MANY_REQUESTS);
    }

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
        throw new HttpException({ code: "hold_limit" }, HttpStatus.TOO_MANY_REQUESTS);
      }
      throw error;
    }
  }

  // R250: the customer let go of the time. Always 204 — an unknown or expired
  // hold is already released.
  @Delete("holds/:holdId")
  @HttpCode(204)
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

    const { visit, magicLinkToken } = await this.visits.create({
      serviceIds: parseIdList(body.serviceIds),
      professionalIds: Array.isArray(body.professionalIds) ? body.professionalIds : [],
      locationId: body.locationId,
      date: body.date,
      time: body.time,
      userName: body.userName,
      phoneNumber: body.phoneNumber,
      email,
      holdId: parseHoldId(body.holdId),
    });

    const url = this.buildManageUrl(magicLinkToken);
    if (email) {
      await this.sendLink(visit, email, url);
    }

    return { visit: serializeVisit(visit), manageUrl: url };
  }

  @Get("manage/:token")
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
  @ApiParam({ name: "token" })
  @ApiQuery({ name: "date", description: "YYYY-MM-DD, in tenant timezone" })
  @ApiOkResponse({ type: [VisitSlotDto] })
  getRescheduleAvailability(@Param("token") token: string, @Query("date") date: string): Promise<VisitSlot[]> {
    return this.visits.rescheduleSlots(token, date);
  }

  // R110: rescheduling rotates the token; R230: the whole visit moves
  @Patch("manage/:token/reschedule")
  @ApiParam({ name: "token" })
  @ApiBody({ type: RescheduleAppointmentRequestDto })
  @ApiOkResponse({ type: RescheduleVisitResponseDto })
  async rescheduleAppointment(
    @Param("token") token: string,
    @Body() body: RescheduleAppointmentRequest,
  ): Promise<RescheduleAppointmentResponse> {
    const { visit, magicLinkToken } = await this.visits.reschedule(token, body.date, body.time);

    const manageUrl = this.buildManageUrl(magicLinkToken);
    const email = this.contactEmail(visit);
    if (email) {
      await this.sendLink(visit, email, manageUrl);
    }

    // R110: the token the caller arrived with is dead now, so the replacement
    // goes back in the response as well as by email — the customer must not be
    // locked out of their own booking by the act of moving it.
    return { visit: serializeVisit(visit), manageUrl };
  }

  // R230: the customer cancels the whole visit; R90: rows stay as history
  @Post("manage/:token/cancel")
  @ApiParam({ name: "token" })
  @ApiOkResponse({ type: VisitDto })
  async cancelAppointment(@Param("token") token: string): Promise<Visit> {
    return serializeVisit(await this.visits.cancel(token));
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

    // Nothing to re-send to when the customer gave no address (R30) — the
    // lookup only returns visits with an email on an upcoming segment.
    const visits = await this.visits.findResendable(phoneNumber);

    for (const visit of visits) {
      const email = this.contactEmail(visit);
      const magicLinkToken = await this.visits.reissue(visit.id);
      if (!magicLinkToken || !email) {
        continue;
      }
      await this.sendLink(visit, email, this.buildManageUrl(magicLinkToken));
    }
  }

  /** Every segment carries the same contact details; the first live one speaks for the visit. */
  private contactEmail(visit: PrismaVisit): string {
    const live = visit.appointments.find((appointment) => appointment.status !== "cancelled");
    return (live ?? visit.appointments[0])?.email ?? "";
  }

  private async sendLink(visit: PrismaVisit, email: string, manageUrl: string): Promise<void> {
    const live = visit.appointments.filter((appointment) => appointment.status !== "cancelled");
    const first = live[0] ?? visit.appointments[0];
    if (!first) return;
    await this.notifications.sendMagicLink({
      email,
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

  /**
   * R250: one visitor can't take holds faster than someone deciding would.
   * Fails open like the resend limits — a Redis outage costs the hold, never
   * the booking.
   */
  private async withinHoldLimit(tenantId: string, ip: string): Promise<boolean> {
    try {
      const key = `hold:${tenantId}:${hashToken(ip)}`;
      return (await this.bumpCounter(key, HOLD_VISITOR_WINDOW_SECONDS)) <= HOLD_MAX_PER_VISITOR;
    } catch {
      return true;
    }
  }

  private async bumpCounter(key: string, windowSeconds = RESEND_WINDOW_SECONDS): Promise<number> {
    const count = await this.redis.client.incr(key);
    if (count === 1) {
      await this.redis.client.expire(key, windowSeconds);
    }
    return count;
  }
}

/**
 * The visitor's address. The public site calls this API from its own server,
 * so the socket address is that server's; it forwards the visitor's address as
 * x-forwarded-for, trusted the same way x-forwarded-host already is for tenant
 * resolution (system_design.md §4). First hop only.
 */
export function visitorIp(forwardedFor: string | undefined, socketIp: string): string {
  const first = (forwardedFor ?? "").split(",")[0]?.trim();
  return first || socketIp;
}
