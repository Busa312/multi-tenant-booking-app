

import type { AppointmentStatus, Visit, VisitSlot } from "./entities";
import type { TenantColors } from "./colors";
import type { LocalizedText } from "./i18n";

export interface UpdateTenantColorsRequest {
  colors: TenantColors;
}

/**
 * R160: which languages the public site publishes in.
 *
 * The first entry is the tenant's default locale — the one the plain `name`
 * columns hold — so it cannot be removed here. Changing *which* language is
 * default would mean moving every stored string between columns, which is a
 * migration, not a checkbox.
 */
export interface UpdateTenantLocalesRequest {
  enabledLocales: string[];
}

// R220: owner-only booking rules
export interface UpdateTenantBookingRulesRequest {
  maxVisitGapMinutes: number;
}

export interface UpdateTenantCopyRequest {
  title?: string;
  titleI18n?: LocalizedText;
  description?: string;
  descriptionI18n?: LocalizedText;
}

/**
 * Phone verification, the step before a public booking is taken. SMS delivery
 * is mocked today, so `devCode` carries the code back instead — see
 * StartVerificationResponse.
 */
export interface StartVerificationRequest {
  phoneNumber: string;
}

export interface StartVerificationResponse {
  expiresAt: string;
  /**
   * The code itself, present ONLY while no SMS provider is configured. It
   * disappears once delivery is real, and nothing should depend on it beyond
   * showing it during development.
   */
  devCode: string | null;
}

export interface VerifyPhoneRequest {
  phoneNumber: string;
  code: string;
}

export interface VerifyPhoneResponse {
  /** Single-use, short-lived, and bound to the number it was issued against. */
  verificationToken: string;
}

export interface CreateAppointmentRequest {
  // R210: one to five, in the order they'll be performed
  serviceIds: string[];
  // R200: one entry per service, aligned with `serviceIds` — a professional id,
  // or "any". The booking flow sends the ids from the chosen VisitSlot, so the
  // visit booked is exactly the plan the customer was shown.
  professionalIds: string[];
  // R150: required when the tenant has locations
  locationId?: string;

  date: string;
  time: string;
  userName: string;
  phoneNumber: string;
  // R30: optional, as it is for a staff-taken booking. Without one the link
  // can't be emailed or re-sent, so `manageUrl` is the customer's only copy.
  email?: string;
  // R250: the hold taken when the time was picked. Optional — a booking without
  // one (or with an expired one) still goes through while the time is free.
  holdId?: string;
  /** From VerifyPhoneResponse — proves this phone number was verified. */
  verificationToken: string;
}

export interface CreateAppointmentResponse {
  visit: Visit;

  manageUrl: string;
}

/**
 * R110: rescheduling rotates the token, so the link the customer followed to
 * get here is dead by the time they read this. The replacement rides back on
 * the response — it is the same customer, already proven by the old token, and
 * without it they would be locked out of their own booking until they used the
 * resend-by-phone flow.
 */
export interface RescheduleAppointmentResponse {
  visit: Visit;
  manageUrl: string;
}

export interface RescheduleAppointmentRequest {
  date: string;
  time: string;
}

export interface AvailabilityQuery {
  serviceIds: string[];
  // R200: aligned with serviceIds; each a professional id or "any". Omitted =
  // "any" for every service.
  professionalIds?: string[];
  // R150: narrows candidates to that branch's professionals (plus those at every branch)
  locationId?: string;
  date: string;
  // R250: the asker's own hold, so the time they're holding stays on their list
  holdId?: string;
}

/** R250: hold the time just picked while the customer finishes booking. */
export interface HoldSlotRequest {
  serviceIds: string[];
  // R200: aligned with serviceIds — a professional id, or "any"
  professionalIds: string[];
  locationId?: string;
  date: string;
  time: string;
  /** The customer's previous hold, released by this one. */
  replaceHoldId?: string;
}

export interface HoldSlotResponse {
  holdId: string;
  expiresAt: string;
  /** The plan actually held — re-planned at hold time, so it can differ from the one shown. */
  slot: VisitSlot;
}

export interface CmsAvailabilityQuery {
  serviceIds: string[];

  professionalId?: string;
  // R150: narrows candidates to that branch's professionals
  locationId?: string;
  date: string;

  appointmentId?: string;
}

export interface CmsAppointmentListQuery {
  from?: string;
  to?: string;
}

export interface CreateCmsAppointmentRequest {
  serviceIds: string[];

  professionalId?: string;
  // R150: required when the tenant has locations
  locationId?: string;
  date: string;
  time: string;
  userName: string;
  phoneNumber: string;
  email?: string;
  notes?: string;
  // R60: acknowledge the conflicts a 409 named and book anyway
  override?: boolean;
}

export interface UpdateCmsAppointmentRequest {
  date?: string;
  time?: string;
  professionalId?: string;
  // R150: moving an appointment to another branch
  locationId?: string;

  serviceIds?: string[];
  override?: boolean;
}

// R100: no automatic transition ever happens

export interface UpdateAppointmentStatusRequest {
  status: Exclude<AppointmentStatus, "cancelled">;
}

// "hold" (R250): an online customer is finishing a booking for that time
export type BookingConflictType = "appointment" | "outside_business_hours" | "time_off" | "hold";

// R60: staff may book over any of these

export interface BookingConflict {
  type: BookingConflictType;
  professionalName: string | null;
  // R160
  professionalNameI18n: LocalizedText | null;

  startAt: string | null;
  endAt: string | null;

  detail: string | null;
}

export interface BookingConflictResponse {
  code: "booking_conflict";
  conflicts: BookingConflict[];
}

export interface ResendMagicLinkRequest {
  phoneNumber: string;
}

export interface LoginRequest {
  subdomain: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
}

// R160: every `*I18n` map below carries the NON-default locales

export interface CreateServiceRequest {
  name: string;
  nameI18n?: LocalizedText;
  description?: string | null;
  descriptionI18n?: LocalizedText;
  durationMinutes: number;
  price: string;
  professionalIds: string[];
}

export interface UpdateServiceRequest {
  name?: string;
  nameI18n?: LocalizedText;
  description?: string | null;
  descriptionI18n?: LocalizedText;
  durationMinutes?: number;
  price?: string;

  professionalIds?: string[];
  // R60: deactivation (and reactivation)
  isActive?: boolean;
}

export interface CreateProfessionalRequest {
  name: string;
  nameI18n?: LocalizedText;
  // R180: omitted or null = works at every location
  locationId?: string | null;
  serviceIds?: string[];
}

export interface UpdateProfessionalRequest {
  name?: string;
  nameI18n?: LocalizedText;
  locationId?: string | null;
  isActive?: boolean;
  serviceIds?: string[];
}

export interface CreateLocationRequest {
  name: string;
  nameI18n?: LocalizedText;
  addressLine: string;
  addressLineI18n?: LocalizedText;
  city?: string | null;
  cityI18n?: LocalizedText;
  phone?: string | null;

  latitude?: string | null;
  longitude?: string | null;

  position?: number;
}

export interface UpdateLocationRequest {
  name?: string;
  nameI18n?: LocalizedText;
  addressLine?: string;
  addressLineI18n?: LocalizedText;
  city?: string | null;
  cityI18n?: LocalizedText;
  phone?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  position?: number;
  // R190: deactivation (and reactivation)
  isActive?: boolean;
}

export interface UpcomingAppointmentCountResponse {
  count: number;
}

export interface InviteProfessionalRequest {
  email: string;
}

export interface InviteProfessionalResponse {
  tenantId: string;
  tenantUserId: string;
  email: string;
  token: string;
  expiresAt: string;
}

export interface SetPasswordRequest {
  tenantId: string;
  token: string;
  password: string;
}

export interface CreateTimeOffRequest {
  professionalId?: string;
  startAt: string;
  endAt: string;
  reason?: string;
}

export interface UpsertBusinessHoursRequest {
  professionalId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface OnboardTenantRequest {
  name: string;
  timezone: string;
  subdomain: string;
  ownerEmail: string;
  ownerPassword: string;
}

export interface OnboardTenantResponse {
  tenantId: string;
  subdomain: string;
  ownerUserId: string;
  ownerEmail: string;
}
