import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { ONBOARDING_STEP_ORDER } from "./onboarding-steps.js";

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
  @ApiProperty({ description: "R440: false = the booking site never offers or names a professional" })
  customersChooseProfessional!: boolean;
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
  @ApiProperty({ description: "R520: price is a starting price (\"from 15 ₾\")" }) priceFrom!: boolean;
  @ApiProperty({ nullable: true, type: String, description: "R510: null = uncategorized" }) categoryId!: string | null;
  @ApiProperty({ description: "R510: order within its category" }) position!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: string;
}

export class ServiceCategoryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP }) nameI18n!: Record<string, string> | null;
  @ApiProperty({ description: "R510: order of the categories" }) position!: number;
}

export class CreateServiceCategoryRequestDto {
  @ApiProperty() name!: string;
  @ApiPropertyOptional(LOCALIZED_MAP) nameI18n?: Record<string, string>;
}

export class UpdateServiceCategoryRequestDto extends PartialType(CreateServiceCategoryRequestDto) {}

export class ReorderServiceCategoriesRequestDto {
  @ApiProperty({ type: [String], description: "Every category's id, first to last" }) ids!: string[];
}

export class ReorderServicesRequestDto {
  @ApiProperty({ nullable: true, type: String, description: "The category whose services these are; null = uncategorized" })
  categoryId!: string | null;
  @ApiProperty({ type: [String], description: "All of that category's services, first to last" }) ids!: string[];
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
  @ApiPropertyOptional({ description: "R520: price is a starting price" }) priceFrom?: boolean;
  @ApiPropertyOptional({ nullable: true, type: String, description: "R510: null = uncategorized" }) categoryId?: string | null;
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
  @ApiProperty({ description: "R460: the professional's weekday off (times are 00:00). Never true tenant-wide" })
  isDayOff!: boolean;
}

export class UpsertBusinessHoursRequestDto {
  @ApiPropertyOptional({ description: "Omitted = tenant-wide" }) professionalId?: string;
  @ApiProperty({ minimum: 0, maximum: 6 }) dayOfWeek!: number;
  @ApiProperty({ example: "09:00" }) startTime!: string;
  @ApiProperty({ example: "17:00" }) endTime!: string;
  @ApiPropertyOptional({ description: "R460: marks the weekday off; times are ignored. Requires professionalId" })
  isDayOff?: boolean;
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
  @ApiProperty({ description: "R520: booked at a starting price" }) priceFrom!: boolean;
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

export class OnboardingStepDto {
  @ApiProperty({ enum: ONBOARDING_STEP_ORDER }) id!: string;
  @ApiProperty({ description: "Read from the salon's data" }) done!: boolean;
  @ApiProperty({ description: "The owner skipped it for now" }) skipped!: boolean;
}

export class OnboardingStatusDto {
  @ApiProperty({ type: [OnboardingStepDto], description: "R420: every step, in order" }) steps!: OnboardingStepDto[];
  @ApiProperty({ description: "Finished, or hidden by the owner" }) dismissed!: boolean;
  @ApiProperty({ description: "Nothing done or skipped yet" }) firstRun!: boolean;
}

export class UpdateOnboardingRequestDto {
  @ApiPropertyOptional({ enum: ONBOARDING_STEP_ORDER }) skip?: string;
  @ApiPropertyOptional({ enum: ONBOARDING_STEP_ORDER }) unskip?: string;
  @ApiPropertyOptional({ description: "true: hide without finishing; false: show the setup again" }) dismissed?: boolean;
  @ApiPropertyOptional({ enum: [true], description: "Finish the setup; also hides it" }) finished?: boolean;
}

export class OpeningHoursDto {
  @ApiProperty({ description: "0 = Sunday … 6 = Saturday" }) dayOfWeek!: number;
  @ApiProperty({ description: "HH:mm, salon's clock" }) opens!: string;
  @ApiProperty({ description: "HH:mm, salon's clock" }) closes!: string;
}

export class BlockedPhoneDto {
  @ApiProperty() id!: string;
  @ApiProperty({ description: "As staff entered it" }) phoneNumber!: string;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
  @ApiProperty() createdAt!: string;
}

export class BlockPhoneRequestDto {
  @ApiProperty() phoneNumber!: string;
  @ApiPropertyOptional({ description: "For the salon's own reference; never shown to the customer" }) reason?: string;
}

export class UnblockPhoneRequestDto {
  @ApiProperty({ description: "Matched however it is spelled" }) phoneNumber!: string;
}

export class PhoneBlockedResponseDto {
  @ApiProperty({ enum: ["phone_blocked"] }) code!: "phone_blocked";
}

export class NoShowHistoryDto {
  @ApiProperty({ description: "How many of those visits the customer missed" }) missed!: number;
  @ApiProperty({ description: "Finished visits looked at: 1 to 3" }) of!: number;
}

export class AppointmentSummaryDto extends AppointmentDto {
  @ApiProperty({
    nullable: true,
    type: NoShowHistoryDto,
    description: "R360: the customer's last finished visits before this one; null = none yet",
  })
  noShowHistory!: NoShowHistoryDto | null;
  @ApiProperty({ description: "R380: this salon has blocked the customer's number from booking online" })
  phoneBlocked!: boolean;
  @ApiProperty({ nullable: true, type: String, description: "TenantUser who created it; null = customer's own booking" })
  createdByUserId!: string | null;
  @ApiProperty({ nullable: true, type: String, description: "Internal staff note — never shown to the customer" })
  notes!: string | null;
  @ApiProperty({ nullable: true, type: String }) professionalName!: string | null;
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP, description: "R160" }) professionalNameI18n!: Record<string, string> | null;
  @ApiProperty({ nullable: true, type: String, description: "Joined so a calendar row needs no second lookup" })
  locationName!: string | null;
  @ApiProperty({ nullable: true, ...LOCALIZED_MAP, description: "R160" }) locationNameI18n!: Record<string, string> | null;
  @ApiProperty({ description: "A customer magic link exists (public-site booking); moving keeps it working (R230)" })
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
  @ApiProperty({ description: "R520: some service in it was booked at a starting price" }) priceFrom!: boolean;
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
  @ApiProperty({ nullable: true, type: NoShowHistoryDto, description: "R360: the customer being booked" })
  noShowHistory!: NoShowHistoryDto | null;
}

export class OtpCooldownResponseDto {
  @ApiProperty({ enum: ["otp_cooldown"] }) code!: "otp_cooldown";
  @ApiProperty() retryAfterSeconds!: number;
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

export class UpdateTenantBookingRulesRequestDto {
  @ApiPropertyOptional({ enum: [0, 5, 10, 15, 20, 30, 45, 60], description: "R220: longest gap between visit segments" })
  maxVisitGapMinutes?: number;
  @ApiPropertyOptional({ description: "R280: minutes; one of BOOKING_NOTICE_OPTIONS" }) minBookingNoticeMinutes?: number;
  @ApiPropertyOptional({ description: "R290: days; one of BOOKING_ADVANCE_OPTIONS" }) maxBookingAdvanceDays?: number;
  @ApiPropertyOptional({ description: "R300: hours; one of CHANGE_CUTOFF_OPTIONS" }) changeCutoffHours?: number;
  @ApiPropertyOptional({ description: "R440: whether customers pick who serves them online" })
  customersChooseProfessional?: boolean;
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
  @ApiProperty({ type: [AppointmentSummaryDto], description: "R360: next 7 days, customers with a missed visit, soonest first" })
  atRisk!: AppointmentSummaryDto[];
  @ApiProperty() atRiskCount!: number;
  @ApiProperty({ type: [DashboardDayDto], description: "Today and the next 6 days" }) week!: DashboardDayDto[];
  @ApiProperty({ type: DashboardPeriodDto, description: "The last 30 days" }) current!: DashboardPeriodDto;
  @ApiProperty({ type: DashboardPeriodDto, description: "The 30 days before" }) previous!: DashboardPeriodDto;
}

// ---- R470–R490: subscriptions ----

const PLAN_IDS = ["early", "standard", "pro"];
const SUBSCRIPTION_STATUSES = ["free", "trial", "active", "past_due", "lapsed"];

export class SubscriptionPlanDto {
  @ApiProperty({ enum: PLAN_IDS }) id!: string;
  @ApiProperty({ example: "60.00", description: "GEL per month" }) price!: string;
  @ApiProperty() smsIncluded!: number;
  @ApiProperty() multipleLocations!: boolean;
  @ApiProperty() prioritySupport!: boolean;
}

export class SubscriptionPaymentSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() orderId!: string;
  @ApiProperty({ enum: ["signup", "renewal", "card"] }) kind!: string;
  @ApiProperty({ enum: PLAN_IDS, nullable: true, type: String }) planId!: string | null;
  @ApiProperty({ example: "60.00" }) amount!: string;
  @ApiProperty({ enum: ["pending", "approved", "declined", "expired"] }) status!: string;
  @ApiProperty({ nullable: true, type: String }) periodStart!: string | null;
  @ApiProperty({ nullable: true, type: String }) periodEnd!: string | null;
  @ApiProperty({ description: "R500: extra texts from the month before periodStart, charged with this renewal" }) extraTexts!: number;
  @ApiProperty({ example: "1.40", description: "Included in amount" }) extraTextsAmount!: string;
  @ApiProperty({ nullable: true, type: String }) cardMasked!: string | null;
  @ApiProperty({ nullable: true, type: String }) failureReason!: string | null;
  @ApiProperty() createdAt!: string;
}

export class SubscriptionCardDto {
  @ApiProperty({ example: "444455XXXXXX1111" }) masked!: string;
  @ApiProperty({ nullable: true, type: String }) brand!: string | null;
}

export class SmsUsageDto {
  @ApiProperty({ description: "SMS parts accepted by the provider in the usage window" }) used!: number;
  @ApiProperty({ description: "The plan's monthly allowance" }) included!: number;
  @ApiProperty() periodStart!: string;
  @ApiProperty({ description: "Exclusive" }) periodEnd!: string;
  @ApiProperty({ description: "true = the salon's paid month; false = the calendar month" }) billingMonth!: boolean;
  @ApiProperty({ description: "Extra texts in this window are charged with the renewal at periodEnd" }) billable!: boolean;
  @ApiProperty() extra!: number;
  @ApiProperty({ example: "1.40" }) extraAmount!: string;
  @ApiProperty({ example: "0.07" }) extraTextPrice!: string;
}

export class SubscriptionOverviewDto {
  @ApiProperty({ enum: SUBSCRIPTION_STATUSES, description: "R480: derived, never stored" }) status!: string;
  @ApiProperty({ enum: PLAN_IDS }) planId!: string;
  @ApiProperty({ enum: PLAN_IDS, nullable: true, type: String, description: "Takes effect at the next renewal" })
  nextPlanId!: string | null;
  @ApiProperty() trialEndsAt!: string;
  @ApiProperty({ nullable: true, type: String, description: "null = never paid" }) paidThrough!: string | null;
  @ApiProperty({ nullable: true, type: String, description: "When booking pauses if nothing is paid (past_due only)" })
  graceEndsAt!: string | null;
  @ApiProperty() cancelAtPeriodEnd!: boolean;
  @ApiProperty({ description: "R490" }) bookingPaused!: boolean;
  @ApiProperty({ type: SubscriptionCardDto, nullable: true }) card!: SubscriptionCardDto | null;
  @ApiProperty({ type: [SubscriptionPlanDto] }) plans!: SubscriptionPlanDto[];
  @ApiProperty({ type: [SubscriptionPaymentSummaryDto], description: "Newest first" }) payments!: SubscriptionPaymentSummaryDto[];
  @ApiProperty({ type: SmsUsageDto, description: "R500" }) sms!: SmsUsageDto;
  @ApiProperty({ description: "false = no payment provider configured on this server" }) billingAvailable!: boolean;
}

export class ConfirmPaymentResponseDto {
  @ApiProperty({ type: SubscriptionPaymentSummaryDto }) payment!: SubscriptionPaymentSummaryDto;
  @ApiProperty({ type: SubscriptionOverviewDto }) subscription!: SubscriptionOverviewDto;
}

export class StartCheckoutRequestDto {
  @ApiProperty({ enum: ["early", "pro"] }) planId!: string;
  @ApiPropertyOptional({ enum: ["ka", "en"], description: "Language of Flitt's payment page" }) lang?: string;
}

export class StartCardChangeRequestDto {
  @ApiPropertyOptional({ enum: ["ka", "en"], description: "Language of Flitt's payment page" }) lang?: string;
}

export class CheckoutResponseDto {
  @ApiProperty({ description: "Flitt's hosted payment page" }) checkoutUrl!: string;
  @ApiProperty() orderId!: string;
}

export class UpdateSubscriptionRequestDto {
  @ApiPropertyOptional({ enum: PLAN_IDS, description: "Switch at the next renewal" }) planId?: string;
  @ApiPropertyOptional() cancelAtPeriodEnd?: boolean;
}
