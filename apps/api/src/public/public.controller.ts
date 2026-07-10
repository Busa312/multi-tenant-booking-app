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

/**
 * Public, unauthenticated routes for apps/public-site. Tenant identity comes
 * from HostTenantMiddleware (Host header -> tenant_id via TenantResolverService),
 * applied in AppModule.
 *
 * Slot computation and the magic-link booking/reschedule/cancel flow are
 * deliberately left as stubs here (NotImplementedException) — see
 * system_design.md §6 "Magic Link Flow" and the Data Model doc's "Time-slots
 * are computed, not stored" note for the algorithms to implement:
 * availability = BusinessHours minus TimeOff minus existing Appointments,
 * and booking must hash+store an access token with `end_at + 24h` expiry.
 */
@ApiTags("public")
@Controller("public")
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
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
    const services = await this.prisma.forTenant((tx) => tx.service.findMany({ where: { tenantId } }));
    return services.map(serializeService);
  }

  @Get("professionals")
  @ApiOkResponse({ type: [ProfessionalDto] })
  async listProfessionals(): Promise<Professional[]> {
    const { tenantId } = this.tenantContext.current;
    const professionals = await this.prisma.forTenant((tx) => tx.professional.findMany({ where: { tenantId } }));
    return professionals.map(serializeProfessional);
  }

  @Get("availability")
  @ApiQuery({ name: "serviceIds", description: "Comma-separated service ids" })
  @ApiQuery({ name: "professionalId", required: false })
  @ApiQuery({ name: "date", description: "YYYY-MM-DD, in tenant timezone" })
  @ApiOkResponse({ type: [AvailabilitySlotDto] })
  getAvailability(@Query() _query: AvailabilityQuery): Promise<AvailabilitySlot[]> {
    throw new NotImplementedException(
      "Availability computation (BusinessHours - TimeOff - Appointments) is not yet implemented",
    );
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
