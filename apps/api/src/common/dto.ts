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
  @ApiPropertyOptional() text?: string;
}

export class TenantConfigCopyDto {
  @ApiPropertyOptional() tagline?: string;
  @ApiPropertyOptional() aboutText?: string;
}

export class TenantConfigSeoDto {
  @ApiPropertyOptional({ description: "Overrides the generated `${name} — Book online`" }) title?: string;
  @ApiPropertyOptional({ description: "Meta description; falls back to copy.tagline" }) description?: string;
  @ApiPropertyOptional({ description: "Absolute https URL" }) ogImageUrl?: string;
  @ApiPropertyOptional({
    description: "Tenant's explicit opt-out. Can only hide — indexability is otherwise computed.",
  })
  noindex?: boolean;
}

export class TenantConfigBusinessDto {
  @ApiPropertyOptional() streetAddress?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() region?: string;
  @ApiPropertyOptional() postalCode?: string;
  @ApiPropertyOptional({ description: "ISO 3166-1 alpha-2, e.g. GE" }) country?: string;
  @ApiPropertyOptional() telephone?: string;
  @ApiPropertyOptional({ description: "Sent together with longitude" }) latitude?: number;
  @ApiPropertyOptional({ description: "Sent together with latitude" }) longitude?: number;
}

export class TenantConfigDto {
  @ApiPropertyOptional() logoUrl?: string;
  @ApiPropertyOptional({ type: TenantConfigColorsDto }) colors?: TenantConfigColorsDto;
  @ApiPropertyOptional({ type: TenantConfigCopyDto }) copy?: TenantConfigCopyDto;
  @ApiPropertyOptional({ type: TenantConfigSeoDto }) seo?: TenantConfigSeoDto;
  @ApiPropertyOptional({ type: TenantConfigBusinessDto }) business?: TenantConfigBusinessDto;
  @ApiPropertyOptional({
    type: [String],
    description: "Public content locales, first entry = default (R80). Absent or single-entry = monolingual.",
  })
  enabledLocales?: string[];
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
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: string;
}

export class ProfessionalSummaryDto extends ProfessionalDto {
  @ApiProperty({ type: [String] }) serviceIds!: string[];
  @ApiProperty({ enum: ["none", "invited", "active"] }) cmsLoginStatus!: "none" | "invited" | "active";
  @ApiProperty({ nullable: true, type: Boolean }) cmsLoginActive!: boolean | null;
  @ApiProperty({ description: "Any appointment ever — when true, only deactivation is allowed" })
  hasAppointmentHistory!: boolean;
}

export class CreateProfessionalRequestDto {
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ type: [String] }) serviceIds?: string[];
}

export class UpdateProfessionalRequestDto {
  @ApiPropertyOptional() name?: string;
  @ApiPropertyOptional() isActive?: boolean;
  @ApiPropertyOptional({ type: [String] }) serviceIds?: string[];
}

export class InviteProfessionalRequestDto {
  @ApiProperty() email!: string;
}

export class InviteProfessionalResponseDto {
  @ApiProperty() tenantId!: string;
  @ApiProperty() tenantUserId!: string;
  @ApiProperty() email!: string;
  @ApiProperty() token!: string;
  @ApiProperty() expiresAt!: string;
}

export class SetPasswordRequestDto {
  @ApiProperty() tenantId!: string;
  @ApiProperty() token!: string;
  @ApiProperty() password!: string;
}

export class ServiceDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty({ description: "Decimal, transported as a string to avoid float precision loss" })
  price!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: string;
}

export class ServiceSummaryDto extends ServiceDto {
  @ApiProperty({ type: [String] }) professionalIds!: string[];
  @ApiProperty({ description: "Any appointment ever — when true, only deactivation is allowed (R70)" })
  hasAppointmentHistory!: boolean;
}

export class CreateServiceRequestDto {
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) description?: string | null;
  @ApiProperty({ minimum: 1, description: "Positive whole number of minutes" }) durationMinutes!: number;
  @ApiProperty({ example: "45.00", description: "Positive decimal, in GEL" }) price!: string;
  @ApiProperty({ type: [String] }) professionalIds!: string[];
}

export class UpdateServiceRequestDto extends PartialType(CreateServiceRequestDto) {
  @ApiPropertyOptional({ description: "R60: deactivate/reactivate — never a hard delete" }) isActive?: boolean;
}

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

export class AppointmentServiceLineDto {
  @ApiProperty() serviceId!: string;
  @ApiProperty({ description: "The service's current name — not snapshotted" }) name!: string;
  @ApiProperty({ description: "Snapshotted when the service was added to the appointment" })
  durationMinutes!: number;
  @ApiProperty({ description: "Snapshotted when the service was added to the appointment (R40)" })
  price!: string;
}

export class AppointmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty({
    type: [AppointmentServiceLineDto],
    description: "One or more, in order; endAt and price are their sums",
  })
  services!: AppointmentServiceLineDto[];
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

// Staff-facing fields deliberately live here and not on AppointmentDto, which is
// also what a customer's magic link returns.
export class AppointmentSummaryDto extends AppointmentDto {
  @ApiProperty({ nullable: true, type: String, description: "TenantUser who created it; null = customer's own booking" })
  createdByUserId!: string | null;
  @ApiProperty({ nullable: true, type: String, description: "Internal staff note — never shown to the customer" })
  notes!: string | null;
  @ApiProperty({ nullable: true, type: String }) professionalName!: string | null;
  @ApiProperty({ description: "A customer magic link exists (public-site booking) — rescheduling rotates it (R110)" })
  hasMagicLink!: boolean;
}

export class CreateCmsAppointmentRequestDto {
  @ApiProperty({ type: [String], description: "One or more, in order; a service may appear only once" })
  serviceIds!: string[];
  @ApiPropertyOptional({ description: "Required for owner; forced to their own for professional logins (R20)" })
  professionalId?: string;
  @ApiProperty({ example: "2026-08-03", description: "YYYY-MM-DD, tenant timezone" }) date!: string;
  @ApiProperty({ example: "14:00", description: "HH:mm, tenant timezone" }) time!: string;
  @ApiProperty() userName!: string;
  @ApiProperty() phoneNumber!: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() notes?: string;
  @ApiPropertyOptional({ description: "R60: book despite the conflicts the 409 named" }) override?: boolean;
}

export class UpdateCmsAppointmentRequestDto {
  @ApiPropertyOptional({ description: "Send with `time` or not at all" }) date?: string;
  @ApiPropertyOptional() time?: string;
  @ApiPropertyOptional() professionalId?: string;
  @ApiPropertyOptional({
    type: [String],
    description: "Replaces the list; services already on it keep their booked price (R40)",
  })
  serviceIds?: string[];
  @ApiPropertyOptional() override?: boolean;
}

export class UpdateAppointmentStatusRequestDto {
  @ApiProperty({
    enum: ["booked", "completed", "no_show"],
    description: "R100: staff-set only. Cancelling has its own endpoint.",
  })
  status!: "booked" | "completed" | "no_show";
}

export class BookingConflictDto {
  @ApiProperty({ enum: ["appointment", "outside_business_hours", "time_off"] })
  type!: "appointment" | "outside_business_hours" | "time_off";
  @ApiProperty({ nullable: true, type: String }) professionalName!: string | null;
  @ApiProperty({ nullable: true, type: String }) startAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) endAt!: string | null;
  @ApiProperty({ nullable: true, type: String, description: "Customer name, or a time-off block's reason" })
  detail!: string | null;
}

/** 409 body from the CMS create/reschedule routes when `override` isn't set. */
export class BookingConflictResponseDto {
  @ApiProperty({ enum: ["booking_conflict"] }) code!: "booking_conflict";
  @ApiProperty({ type: [BookingConflictDto] }) conflicts!: BookingConflictDto[];
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
  @ApiProperty() subdomain!: string;
  @ApiProperty() email!: string;
  @ApiProperty() password!: string;
}

export class LoginResponseDto {
  @ApiProperty() accessToken!: string;
}

export class UpdateTenantConfigRequestDto {
  @ApiProperty({ type: TenantConfigDto }) configJson!: TenantConfigDto;
}

export class UpdateTenantColorsRequestDto {
  @ApiProperty({ type: TenantConfigColorsDto }) colors!: TenantConfigColorsDto;
}

export class UpdateTenantSeoRequestDto {
  @ApiPropertyOptional({ type: TenantConfigSeoDto, description: "Replaces the stored seo object wholesale" })
  seo?: TenantConfigSeoDto;
  @ApiPropertyOptional({ type: TenantConfigBusinessDto, description: "Replaces the stored business object wholesale" })
  business?: TenantConfigBusinessDto;
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
