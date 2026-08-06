import { Controller, Get, NotImplementedException, Param, Post, Body, Query, Patch } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import type {
  AvailabilityQuery,
  AvailabilitySlot,
  CreateAppointmentRequest,
  CreateAppointmentResponse,
  Appointment,
  ResendMagicLinkRequest,
  RescheduleAppointmentRequest,
  Service,
  Professional,
  Tenant,
} from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { serializeProfessional, serializeService, serializeTenant } from "../common/serializers.js";
import { parseIdList } from "../common/query.js";
import {
  AppointmentDto,
  AvailabilitySlotDto,
  CreateAppointmentRequestDto,
  CreateAppointmentResponseDto,
  ProfessionalDto,
  RescheduleAppointmentRequestDto,
  ResendMagicLinkRequestDto,
  ServiceDto,
  TenantDto,
} from "../common/dto.js";
import { AvailabilityService } from "../booking/availability.service.js";

/**
 * Public, unauthenticated routes for apps/public-site. Tenant identity comes
 * from HostTenantMiddleware (Host header -> tenant_id via TenantResolverService),
 * applied in AppModule.
 *
 * Slot computation is served by the shared AvailabilityService — the same one
 * the CMS booking flow reads, so the two never disagree about what's open. The
 * magic-link booking/reschedule/cancel flow is still stubbed
 * (NotImplementedException): see system_design.md §6 "Magic Link Flow" — booking
 * must hash+store an access token with `end_at + 24h` expiry, which
 * BookingService already does on rotation.
 */
@ApiTags("public")
@Controller("public")
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly availability: AvailabilityService,
  ) {}

  @Get("tenant")
  @ApiOkResponse({ type: TenantDto })
  async getTenant(): Promise<Tenant> {
    const { tenantId } = this.tenantContext.current;
    const tenant = await this.prisma.forTenant((tx) => tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }));
    return serializeTenant(tenant);
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

  @Get("professionals")
  @ApiOkResponse({ type: [ProfessionalDto] })
  async listProfessionals(): Promise<Professional[]> {
    const { tenantId } = this.tenantContext.current;
    // Deactivated professionals (R60) drop out of the booking flow but keep
    // their past/future appointments untouched — this listing is the only
    // thing that changes.
    const professionals = await this.prisma.forTenant((tx) =>
      tx.professional.findMany({ where: { tenantId, isActive: true } }),
    );
    return professionals.map(serializeProfessional);
  }

  @Get("availability")
  @ApiQuery({ name: "serviceIds", description: "Comma-separated service ids" })
  @ApiQuery({ name: "professionalId", required: false })
  @ApiQuery({ name: "date", description: "YYYY-MM-DD, in tenant timezone" })
  @ApiOkResponse({ type: [AvailabilitySlotDto] })
  getAvailability(@Query() query: AvailabilityQuery): Promise<AvailabilitySlot[]> {
    const serviceIds = parseIdList(query.serviceIds);

    return this.availability.computeSlots({
      serviceIds,
      // Omitted = "any available": slots come back for every professional who
      // performs the requested services.
      professionalId: query.professionalId ?? null,
      date: query.date,
    });
  }

  @Post("appointments")
  @ApiBody({ type: CreateAppointmentRequestDto })
  @ApiOkResponse({ type: CreateAppointmentResponseDto })
  createAppointment(@Body() _body: CreateAppointmentRequest): Promise<CreateAppointmentResponse> {
    throw new NotImplementedException("Booking creation + magic-link issuance is not yet implemented");
  }

  @Get("manage/:token")
  @ApiParam({ name: "token" })
  @ApiOkResponse({ type: AppointmentDto })
  getAppointmentByToken(@Param("token") _token: string): Promise<Appointment> {
    throw new NotImplementedException("Magic-link appointment lookup is not yet implemented");
  }

  @Patch("manage/:token/reschedule")
  @ApiParam({ name: "token" })
  @ApiBody({ type: RescheduleAppointmentRequestDto })
  @ApiOkResponse({ type: AppointmentDto })
  rescheduleAppointment(
    @Param("token") _token: string,
    @Body() _body: RescheduleAppointmentRequest,
  ): Promise<Appointment> {
    throw new NotImplementedException("Magic-link reschedule (with token rotation) is not yet implemented");
  }

  @Post("manage/:token/cancel")
  @ApiParam({ name: "token" })
  @ApiOkResponse({ type: AppointmentDto })
  cancelAppointment(@Param("token") _token: string): Promise<Appointment> {
    throw new NotImplementedException("Magic-link cancellation is not yet implemented");
  }

  @Post("manage/resend")
  @ApiBody({ type: ResendMagicLinkRequestDto })
  resendMagicLink(@Body() _body: ResendMagicLinkRequest): Promise<void> {
    throw new NotImplementedException(
      "Rate-limited magic-link resend by phone number is not yet implemented",
    );
  }
}
