import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

export class TenantConfigColorsDto {
  @ApiPropertyOptional() primary?: string;
  @ApiPropertyOptional() secondary?: string;
  @ApiPropertyOptional() background?: string;
  @ApiPropertyOptional() text?: string;
}

// R160: every `*I18n` map on these DTOs carries the NON-default locales only
const LOCALIZED_MAP = {
  type: "object",
  additionalProperties: { type: "string" },
  example: { ka: "ქართული ტექსტი" },
  description: "Non-default locales only, keyed by locale code",
} as const;

// R170: the whole of a tenant's editorial control over the public site

export class TenantConfigCopyDto {
  @ApiPropertyOptional({ description: "Public-site heading, default locale" }) title?: string;
  @ApiPropertyOptional(LOCALIZED_MAP) titleI18n?: Record<string, string>;
  @ApiPropertyOptional({ description: "Public-site blurb, default locale" }) description?: string;
  @ApiPropertyOptional(LOCALIZED_MAP) descriptionI18n?: Record<string, string>;
}

export class TenantConfigDto {
  @ApiPropertyOptional() logoUrl?: string;
  @ApiPropertyOptional({ type: TenantConfigColorsDto }) colors?: TenantConfigColorsDto;
  @ApiPropertyOptional({ type: TenantConfigCopyDto }) copy?: TenantConfigCopyDto;
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

export class LocationDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP }) nameI18n!: Record<string, string> | null;
  @ApiProperty() addressLine!: string;
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP }) addressLineI18n!: Record<string, string> | null;
  @ApiProperty({ nullable: true, type: String }) city!: string | null;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: "Decimal as a string, like price. Set together with longitude or not at all",
  })
  latitude!: string | null;
  @ApiProperty({ nullable: true, type: String }) longitude!: string | null;
  @ApiProperty({ description: "Display order on the public site" }) position!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: string;
}

export class LocationSummaryDto extends LocationDto {
  @ApiProperty({ type: [String] }) professionalIds!: string[];
  @ApiProperty({ description: "Any appointment ever — when true, only deactivation is allowed (R190)" })
  hasAppointmentHistory!: boolean;
}

export class CreateLocationRequestDto {
  @ApiProperty() name!: string;
  @ApiPropertyOptional(LOCALIZED_MAP) nameI18n?: Record<string, string>;
  @ApiProperty() addressLine!: string;
  @ApiPropertyOptional(LOCALIZED_MAP) addressLineI18n?: Record<string, string>;
  @ApiPropertyOptional({ nullable: true, type: String }) city?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) phone?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String, example: "41.712000" }) latitude?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String, example: "44.789000" }) longitude?: string | null;
  @ApiPropertyOptional({ description: "Defaults to the end of the list" }) position?: number;
}

export class UpdateLocationRequestDto extends PartialType(CreateLocationRequestDto) {
  @ApiPropertyOptional({ description: "R190: deactivate/reactivate — never a hard delete once booked" })
  isActive?: boolean;
}

export class ProfessionalDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP }) nameI18n!: Record<string, string> | null;
  @ApiProperty({ nullable: true, type: String, description: "R180: null = works at every location" })
  locationId!: string | null;
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
  @ApiPropertyOptional(LOCALIZED_MAP) nameI18n?: Record<string, string>;
  @ApiPropertyOptional({ nullable: true, type: String, description: "R180: omitted/null = every location" })
  locationId?: string | null;
  @ApiPropertyOptional({ type: [String] }) serviceIds?: string[];
}

export class UpdateProfessionalRequestDto {
  @ApiPropertyOptional() name?: string;
  @ApiPropertyOptional(LOCALIZED_MAP) nameI18n?: Record<string, string>;
  @ApiPropertyOptional({ nullable: true, type: String }) locationId?: string | null;
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
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP }) nameI18n!: Record<string, string> | null;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP }) descriptionI18n!: Record<string, string> | null;
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
  @ApiPropertyOptional(LOCALIZED_MAP) nameI18n?: Record<string, string>;
  @ApiPropertyOptional({ nullable: true, type: String }) description?: string | null;
  @ApiPropertyOptional(LOCALIZED_MAP) descriptionI18n?: Record<string, string>;
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
  @ApiProperty({ nullable: true, type: String, description: "R150: branch booked; null = tenant has no locations" })
  locationId!: string | null;
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

export class AppointmentSummaryDto extends AppointmentDto {
  @ApiProperty({ nullable: true, type: String, description: "TenantUser who created it; null = customer's own booking" })
  createdByUserId!: string | null;
  @ApiProperty({ nullable: true, type: String, description: "Internal staff note — never shown to the customer" })
  notes!: string | null;
  @ApiProperty({ nullable: true, type: String }) professionalName!: string | null;
  @ApiProperty({ nullable: true, type: String, description: "Joined so a calendar row needs no second lookup" })
  locationName!: string | null;
  @ApiProperty({ description: "A customer magic link exists (public-site booking) — rescheduling rotates it (R110)" })
  hasMagicLink!: boolean;
}

export class CreateCmsAppointmentRequestDto {
  @ApiProperty({ type: [String], description: "One or more, in order; a service may appear only once" })
  serviceIds!: string[];
  @ApiPropertyOptional({ description: "Required for owner; forced to their own for professional logins (R20)" })
  professionalId?: string;
  @ApiPropertyOptional({ description: "R150: required when the tenant has locations" }) locationId?: string;
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
  @ApiPropertyOptional({ description: "R150: move the appointment to another branch" }) locationId?: string;
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

export class BookingConflictResponseDto {
  @ApiProperty({ enum: ["booking_conflict"] }) code!: "booking_conflict";
  @ApiProperty({ type: [BookingConflictDto] }) conflicts!: BookingConflictDto[];
}

export class StartVerificationRequestDto {
  @ApiProperty() phoneNumber!: string;
}

export class StartVerificationResponseDto {
  @ApiProperty() expiresAt!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    description: "The code itself — present only while SMS delivery is mocked",
  })
  devCode!: string | null;
}

export class VerifyPhoneRequestDto {
  @ApiProperty() phoneNumber!: string;
  @ApiProperty({ example: "123456" }) code!: string;
}

export class VerifyPhoneResponseDto {
  @ApiProperty({ description: "Single-use, bound to the verified number" }) verificationToken!: string;
}

export class CreateAppointmentRequestDto {
  @ApiProperty({ type: [String] }) serviceIds!: string[];
  @ApiPropertyOptional({ description: 'Omitted = "any available"' }) professionalId?: string;
  @ApiPropertyOptional({ description: "R150: required when the tenant has locations" }) locationId?: string;

  @ApiProperty({ example: "2026-08-03", description: "YYYY-MM-DD, tenant timezone" }) date!: string;
  @ApiProperty({ example: "14:00", description: "HH:mm, tenant timezone" }) time!: string;
  @ApiProperty() userName!: string;
  @ApiProperty() phoneNumber!: string;
  @ApiPropertyOptional({ description: "R30: optional — without it the link can't be emailed or re-sent" })
  email?: string;
  @ApiProperty({ description: "From POST /public/verification/verify" }) verificationToken!: string;
}

export class CreateAppointmentResponseDto {
  @ApiProperty() appointmentId!: string;
  @ApiProperty() startAt!: string;
  @ApiProperty() endAt!: string;
  @ApiProperty({
    description: "The customer's magic link — returned because email delivery is stubbed (no provider wired in)",
  })
  manageUrl!: string;
}

export class RescheduleAppointmentRequestDto {
  @ApiProperty({ example: "2026-08-03", description: "YYYY-MM-DD, tenant timezone" }) date!: string;
  @ApiProperty({ example: "14:00", description: "HH:mm, tenant timezone" }) time!: string;
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

export class UpdateTenantCopyRequestDto extends TenantConfigCopyDto {}

export class UpdateTenantLocalesRequestDto {
  @ApiProperty({
    type: [String],
    example: ["en", "ka"],
    description: "R160: first entry is the default locale and can't be removed",
  })
  enabledLocales!: string[];
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
