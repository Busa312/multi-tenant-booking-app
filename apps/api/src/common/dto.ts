import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

// Swagger-only class mirrors of the shared-types interfaces (packages/shared-types/src).
// @nestjs/swagger's compile-time plugin can't reliably infer OpenAPI schemas
// from interfaces imported across a package boundary, so these exist purely
// to give /docs real request/response shapes — @Body()/return types in
// controllers stay the shared-types interfaces; these classes are only
// referenced from @ApiBody/@ApiResponse. Keep in sync with shared-types by hand.

export class TenantConfigColorsDto {
  @ApiPropertyOptional() primary?: string;
  @ApiPropertyOptional() secondary?: string;
  @ApiPropertyOptional() background?: string;
}

export class TenantConfigCopyDto {
  @ApiPropertyOptional() tagline?: string;
  @ApiPropertyOptional() aboutText?: string;
}

export class TenantConfigDto {
  @ApiPropertyOptional() logoUrl?: string;
  @ApiPropertyOptional({ type: TenantConfigColorsDto }) colors?: TenantConfigColorsDto;
  @ApiPropertyOptional({ type: TenantConfigCopyDto }) copy?: TenantConfigCopyDto;
}

export class TenantDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() subdomain!: string;
  @ApiProperty({ nullable: true, type: String }) customDomain!: string | null;
  @ApiProperty({ nullable: true, type: String }) domainVerifiedAt!: string | null;
  @ApiProperty({ type: TenantConfigDto }) configJson!: TenantConfigDto;
  @ApiProperty() createdAt!: string;
}

export class ProfessionalDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() createdAt!: string;
}

export class CreateProfessionalRequestDto {
  @ApiProperty() name!: string;
}

export class ServiceDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty({ description: "Decimal, transported as a string to avoid float precision loss" })
  price!: string;
  @ApiProperty() createdAt!: string;
}

export class CreateServiceRequestDto {
  @ApiProperty() name!: string;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty() price!: string;
  @ApiProperty({ type: [String] }) professionalIds!: string[];
}

export class UpdateServiceRequestDto extends PartialType(CreateServiceRequestDto) {}

export class BusinessHoursDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty({ nullable: true, type: String, description: "null = applies tenant-wide" })
  professionalId!: string | null;
  @ApiProperty({ minimum: 0, maximum: 6 }) dayOfWeek!: number;
  @ApiProperty({ example: "09:00" }) startTime!: string;
  @ApiProperty({ example: "17:00" }) endTime!: string;
}

export class UpsertBusinessHoursRequestDto {
  @ApiPropertyOptional({ description: "Omitted = tenant-wide" }) professionalId?: string;
  @ApiProperty({ minimum: 0, maximum: 6 }) dayOfWeek!: number;
  @ApiProperty({ example: "09:00" }) startTime!: string;
  @ApiProperty({ example: "17:00" }) endTime!: string;
}

export class TimeOffDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty({ nullable: true, type: String, description: "null = whole business closed" })
  professionalId!: string | null;
  @ApiProperty() startAt!: string;
  @ApiProperty() endAt!: string;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
}

export class CreateTimeOffRequestDto {
  @ApiPropertyOptional({ description: "Omitted = whole business closed" }) professionalId?: string;
  @ApiProperty() startAt!: string;
  @ApiProperty() endAt!: string;
  @ApiPropertyOptional() reason?: string;
}

export class AppointmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty() serviceId!: string;
  @ApiProperty({ nullable: true, type: String, description: '"any available" was chosen' })
  professionalId!: string | null;
  @ApiProperty() userName!: string;
  @ApiProperty() phoneNumber!: string;
  @ApiProperty() email!: string;
  @ApiProperty() startAt!: string;
  @ApiProperty() endAt!: string;
  @ApiProperty() price!: string;
  @ApiProperty({ enum: ["booked", "cancelled", "completed", "no_show"] })
  status!: "booked" | "cancelled" | "completed" | "no_show";
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class CreateAppointmentRequestDto {
  @ApiProperty({ type: [String] }) serviceIds!: string[];
  @ApiPropertyOptional({ description: 'Omitted = "any available"' }) professionalId?: string;
  @ApiProperty() startAt!: string;
  @ApiProperty() userName!: string;
  @ApiProperty() phoneNumber!: string;
  @ApiProperty() email!: string;
}

export class CreateAppointmentResponseDto {
  @ApiProperty() appointmentId!: string;
  @ApiProperty() startAt!: string;
  @ApiProperty() endAt!: string;
}

export class RescheduleAppointmentRequestDto {
  @ApiProperty() startAt!: string;
}

export class ResendMagicLinkRequestDto {
  @ApiProperty() phoneNumber!: string;
}

export class AvailabilitySlotDto {
  @ApiProperty() startAt!: string;
  @ApiProperty() endAt!: string;
  @ApiProperty({ nullable: true, type: String }) professionalId!: string | null;
}

export class LoginRequestDto {
  @ApiProperty() email!: string;
  @ApiProperty() password!: string;
}

export class LoginResponseDto {
  @ApiProperty() accessToken!: string;
}

export class UpdateTenantConfigRequestDto {
  @ApiProperty({ type: TenantConfigDto }) configJson!: TenantConfigDto;
}

export class OnboardTenantRequestDto {
  @ApiProperty() name!: string;
  @ApiProperty({ description: "IANA tz, e.g. Asia/Tbilisi" }) timezone!: string;
  @ApiProperty({ description: 'e.g. "acme" for acme.platform.ge' }) subdomain!: string;
  @ApiProperty() ownerEmail!: string;
  @ApiProperty() ownerPassword!: string;
}

export class OnboardTenantResponseDto {
  @ApiProperty() tenantId!: string;
  @ApiProperty() subdomain!: string;
  @ApiProperty() ownerUserId!: string;
  @ApiProperty() ownerEmail!: string;
}
