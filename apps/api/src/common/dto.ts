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
  @ApiProperty({ description: "R220: longest gap in minutes between consecutive visit segments (0–60)" })
  maxVisitGapMinutes!: number;
  @ApiProperty({ description: "R280: minutes" }) minBookingNoticeMinutes!: number;
  @ApiProperty({ description: "R290: days" }) maxBookingAdvanceDays!: number;
  @ApiProperty({ description: "R300: hours" }) changeCutoffHours!: number;
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
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP }) cityI18n!: Record<string, string> | null;
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
  @ApiPropertyOptional(LOCALIZED_MAP) cityI18n?: Record<string, string>;
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

export class PublicProfessionalDto extends ProfessionalDto {
  @ApiProperty({ type: [String], description: "R240: the services this professional performs" })
  serviceIds!: string[];
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

export class ForgotPasswordRequestDto {
  @ApiProperty() subdomain!: string;
  @ApiProperty() email!: string;
}

export class ResetPasswordRequestDto {
  @ApiProperty() tenantId!: string;
  @ApiProperty() token!: string;
  @ApiProperty({ description: "R310: at least 10 characters, at most 72 bytes" }) password!: string;
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
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP, description: "R160: the name's translations" })
  nameI18n!: Record<string, string> | null;
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
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP, description: "R160" }) professionalNameI18n!: Record<string, string> | null;
  @ApiProperty({ nullable: true, type: String, description: "Joined so a calendar row needs no second lookup" })
  locationName!: string | null;
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP, description: "R160" }) locationNameI18n!: Record<string, string> | null;
  @ApiProperty({ description: "A customer magic link exists (public-site booking) — rescheduling rotates it (R110)" })
  hasMagicLink!: boolean;
  @ApiProperty({
    nullable: true,
    type: String,
    description: "R200: the customer visit this is one segment of; null = staff-created",
  })
  visitId!: string | null;
}

export class VisitSegmentDto {
  @ApiProperty() appointmentId!: string;
  @ApiProperty({ type: [AppointmentServiceLineDto] }) services!: AppointmentServiceLineDto[];
  @ApiProperty({ nullable: true, type: String }) professionalId!: string | null;
  @ApiProperty({ nullable: true, type: String }) professionalName!: string | null;
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP, description: "R160" }) professionalNameI18n!: Record<string, string> | null;
  @ApiProperty() startAt!: string;
  @ApiProperty() endAt!: string;
  @ApiProperty({ enum: ["booked", "cancelled", "completed", "no_show"] })
  status!: "booked" | "cancelled" | "completed" | "no_show";
}

export class VisitDto {
  @ApiProperty() id!: string;
  @ApiProperty({
    enum: ["booked", "cancelled", "completed", "no_show"],
    description: "Derived: cancelled only when every segment is (R230)",
  })
  status!: "booked" | "cancelled" | "completed" | "no_show";
  @ApiProperty() startAt!: string;
  @ApiProperty() endAt!: string;
  @ApiProperty({ description: "Sum of the segments still happening" }) price!: string;
  @ApiProperty({ nullable: true, type: String }) locationId!: string | null;
  @ApiProperty({ nullable: true, type: String }) locationName!: string | null;
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP, description: "R160" }) locationNameI18n!: Record<string, string> | null;
  @ApiProperty({ type: [VisitSegmentDto], description: "R200: one per professional appointment, in time order" })
  segments!: VisitSegmentDto[];
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
  @ApiProperty({ enum: ["appointment", "outside_business_hours", "time_off", "hold"], description: "hold = R250" })
  type!: "appointment" | "outside_business_hours" | "time_off" | "hold";
  @ApiProperty({ nullable: true, type: String }) professionalName!: string | null;
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP, description: "R160" }) professionalNameI18n!: Record<string, string> | null;
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
  @ApiProperty({ type: [String], description: "R210: one to five, in the order they'll be performed" })
  serviceIds!: string[];
  @ApiProperty({
    type: [String],
    description: 'R200: one per service, aligned with serviceIds — a professional id or "any"',
  })
  professionalIds!: string[];
  @ApiPropertyOptional({ description: "R150: required when the tenant has locations" }) locationId?: string;

  @ApiProperty({ example: "2026-08-03", description: "YYYY-MM-DD, tenant timezone" }) date!: string;
  @ApiProperty({ example: "14:00", description: "HH:mm, tenant timezone" }) time!: string;
  @ApiProperty() userName!: string;
  @ApiProperty() phoneNumber!: string;
  @ApiProperty({ description: "From POST /public/verification/verify" }) verificationToken!: string;
  @ApiPropertyOptional({ description: "R250: the hold from POST /public/holds — optional, used up by the booking" })
  holdId?: string;
}

export class CreateAppointmentResponseDto {
  @ApiProperty({ type: VisitDto }) visit!: VisitDto;
  @ApiProperty({ description: "The customer's magic link — always returned, so the confirmation screen can show it" })
  manageUrl!: string;
  @ApiProperty({ description: "R270: also texted to the verified phone (false while SMS is mocked)" }) linkTexted!: boolean;
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

export class VisitSlotSegmentDto {
  @ApiProperty({ type: [String], description: "Consecutive services this professional performs with no gap" })
  serviceIds!: string[];
  @ApiProperty() professionalId!: string;
  @ApiProperty() startAt!: string;
  @ApiProperty() endAt!: string;
}

export class VisitSlotDto {
  @ApiProperty() startAt!: string;
  @ApiProperty() endAt!: string;
  @ApiProperty({ type: [VisitSlotSegmentDto], description: "R200: the plan — one entry per appointment to be booked" })
  segments!: VisitSlotSegmentDto[];
}

export class HoldSlotRequestDto {
  @ApiProperty({ type: [String], description: "R210: one to five, in the order they'll be performed" })
  serviceIds!: string[];
  @ApiProperty({ type: [String], description: 'R200: one per service, aligned with serviceIds — a professional id or "any"' })
  professionalIds!: string[];
  @ApiPropertyOptional({ description: "R150: required when the tenant has locations" }) locationId?: string;
  @ApiProperty({ example: "2026-08-03", description: "YYYY-MM-DD, tenant timezone" }) date!: string;
  @ApiProperty({ example: "14:00", description: "HH:mm, tenant timezone" }) time!: string;
  @ApiPropertyOptional({ description: "R250: the customer's previous hold, released by this one" })
  replaceHoldId?: string;
}

export class HoldSlotResponseDto {
  @ApiProperty() holdId!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ type: VisitSlotDto, description: "The plan actually held — may differ from the one shown" })
  slot!: VisitSlotDto;
}

export class RescheduleVisitResponseDto {
  @ApiProperty({ type: VisitDto }) visit!: VisitDto;
  @ApiProperty({ description: "R110: the rotated link — the one the caller used is dead now" }) manageUrl!: string;
  @ApiProperty({ description: "R270" }) linkTexted!: boolean;
}

export class UpdateTenantBookingRulesRequestDto {
  @ApiPropertyOptional({ enum: [0, 5, 10, 15, 20, 30, 45, 60], description: "R220: longest gap between visit segments" })
  maxVisitGapMinutes?: number;
  @ApiPropertyOptional({ description: "R280: minutes; one of BOOKING_NOTICE_OPTIONS" }) minBookingNoticeMinutes?: number;
  @ApiPropertyOptional({ description: "R290: days; one of BOOKING_ADVANCE_OPTIONS" }) maxBookingAdvanceDays?: number;
  @ApiPropertyOptional({ description: "R300: hours; one of CHANGE_CUTOFF_OPTIONS" }) changeCutoffHours?: number;
}

export class LoginRequestDto {
  @ApiProperty() subdomain!: string;
  @ApiProperty() email!: string;
  @ApiProperty() password!: string;
}

// R320: the session's description — the token itself is only ever in the cookie
export class CmsSessionDto {
  @ApiProperty() userId!: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty({ enum: ["owner", "professional"] }) role!: "owner" | "professional";
  @ApiProperty({ nullable: true, type: String }) professionalId!: string | null;
  @ApiProperty() expiresAt!: string;
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

// R370: the CMS home page

export class DashboardDayDto {
  @ApiProperty({ example: "2026-11-12", description: "Tenant-local date" }) date!: string;
  @ApiProperty({ description: "Visits starting that day, not cancelled; a split visit counts once" }) bookings!: number;
  @ApiProperty({ description: "Minutes of appointments assigned to the professionals in scope" }) bookedMinutes!: number;
  @ApiProperty({ description: "Their business hours that day minus time off" }) workingMinutes!: number;
}

export class DashboardPeriodDto {
  @ApiProperty({ description: "Visits not cancelled; a split visit counts once" }) bookings!: number;
  @ApiProperty({ description: "Of bookings, the ones the customer made online" }) onlineBookings!: number;
  @ApiProperty({ description: "Appointments of every status" }) appointments!: number;
  @ApiProperty() completed!: number;
  @ApiProperty() noShows!: number;
  @ApiProperty() cancelled!: number;
  @ApiProperty({ description: "Clients (by phone) whose first visit falls in the period" }) newClients!: number;
  @ApiProperty() returningClients!: number;
  @ApiProperty({
    nullable: true,
    type: String,
    example: "1240.00",
    description: "Sum of completed appointments' prices; null for a professional login",
  })
  completedValue!: string | null;
}

export class DashboardSummaryDto {
  @ApiProperty({ type: [AppointmentSummaryDto], description: "Past appointments still booked, oldest first" })
  unmarked!: AppointmentSummaryDto[];
  @ApiProperty() unmarkedCount!: number;
  @ApiProperty({ type: [DashboardDayDto], description: "Today and the next 6 days" }) week!: DashboardDayDto[];
  @ApiProperty({ type: DashboardPeriodDto, description: "The last 30 days" }) current!: DashboardPeriodDto;
  @ApiProperty({ type: DashboardPeriodDto, description: "The 30 days before" }) previous!: DashboardPeriodDto;
}
