

import type { AppointmentStatus, AppointmentSummary, TenantUserRole, Visit, VisitSlot, NoShowHistory } from "./entities";
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
  maxVisitGapMinutes?: number;
  minBookingNoticeMinutes?: number;
  maxBookingAdvanceDays?: number;
  changeCutoffHours?: number;
  // R440
  customersChooseProfessional?: boolean;
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

/**
 * 429 from start-verification: a code went to this number under a minute ago.
 * That code still works; a new one can be asked for after `retryAfterSeconds`.
 */
export interface OtpCooldownResponse {
  code: "otp_cooldown";
  retryAfterSeconds: number;
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
  // R250: the hold taken when the time was picked. Optional — a booking without
  // one (or with an expired one) still goes through while the time is free.
  holdId?: string;
  /** From VerifyPhoneResponse — proves this phone number was verified. */
  verificationToken: string;
}

export interface CreateAppointmentResponse {
  visit: Visit;

  manageUrl: string;
  /** R270: the link was texted to the verified phone; false while SMS is mocked. */
  linkTexted: boolean;
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

// R370: the home page's numbers, optionally for one branch (R150)
export interface CmsDashboardQuery {
  locationId?: string;
}

/** R370: one tenant-local day of the week ahead. */
export interface DashboardDay {
  /** Tenant-local "YYYY-MM-DD". */
  date: string;
  /** Visits starting that day, not cancelled. A visit split across professionals counts once. */
  bookings: number;
  /** Minutes of non-cancelled appointments assigned to the professionals in scope. */
  bookedMinutes: number;
  /** Their business hours that day minus time off. 0 = nobody works. */
  workingMinutes: number;
}

/** R370: one rolling period, by appointment start time. */
export interface DashboardPeriod {
  /** Visits that weren't cancelled. A visit split across professionals counts once. */
  bookings: number;
  /** Of `bookings`, the ones the customer made online (no staff author). */
  onlineBookings: number;
  /** Appointments (segments), all statuses: the cancellation rate's denominator. */
  appointments: number;
  completed: number;
  noShows: number;
  cancelled: number;
  /** Clients (by phone) whose first non-cancelled appointment falls in this period. */
  newClients: number;
  /** Clients in this period who had been before it. */
  returningClients: number;
  /**
   * Sum of `price` over completed appointments, at the price saved when each
   * was booked. A decimal string like every price; null for a professional login.
   */
  completedValue: string | null;
}

export interface DashboardSummary {
  /** Past appointments still `booked`, oldest first; the first few only — `unmarkedCount` has the total. */
  unmarked: AppointmentSummary[];
  unmarkedCount: number;
  /**
   * R360: bookings in the next 7 days from customers who missed one of their
   * last visits, soonest first; the first few only — `atRiskCount` has the total.
   */
  atRisk: AppointmentSummary[];
  atRiskCount: number;
  /** Today and the 6 days after it. */
  week: DashboardDay[];
  /** The last 30 days, up to now. */
  current: DashboardPeriod;
  /** The 30 days before that. */
  previous: DashboardPeriod;
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
  // R360: the record of the customer being booked, shown beside the conflicts
  noShowHistory: NoShowHistory | null;
}

export interface ResendMagicLinkRequest {
  phoneNumber: string;
}

export interface LoginRequest {
  subdomain: string;
  email: string;
  password: string;
}

/**
 * R320: what the CMS knows about its own session — never the token, which
 * lives in an httpOnly cookie its JavaScript can't read. Returned by login,
 * set-password and reset-password, and by GET /cms/auth/me.
 */
export interface CmsSession {
  userId: string;
  tenantId: string;
  role: TenantUserRole;
  /** Present only for `professional` logins (R20). */
  professionalId: string | null;
  /** ISO instant; the session ends then at the latest. */
  expiresAt: string;
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

// R310: always answered the same way, whether or not the account exists
export interface ForgotPasswordRequest {
  subdomain: string;
  email: string;
}

export interface ResetPasswordRequest {
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
  /** R460: marks the professional's weekday off; the times are then ignored. Requires `professionalId`. */
  isDayOff?: boolean;
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

// R380
export interface BlockPhoneRequest {
  phoneNumber: string;
  /** Why, for the salon's own reference; never shown to the customer. */
  reason?: string;
}

export interface UnblockPhoneRequest {
  /** Matched however it is spelled ("598 55 05 94" = "+995598550594"). */
  phoneNumber: string;
}

/** R380: 403 from the public booking flow — this salon doesn't take online bookings from the number. */
export interface PhoneBlockedResponse {
  code: "phone_blocked";
}

// R420: the owner's guided setup, in order
export const ONBOARDING_STEPS = ["locations", "hours", "services", "team", "site", "live"] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingStep {
  id: OnboardingStepId;
  /** Read from the salon's data ("live": the setup was finished). */
  done: boolean;
  /** The owner chose to skip it for now. */
  skipped: boolean;
}

export interface OnboardingStatus {
  /** Every step, in order. */
  steps: OnboardingStep[];
  /** Finished, or hidden by the owner: the dashboard and the menu stop showing it. */
  dismissed: boolean;
  /**
   * Nothing done, nothing skipped, not dismissed — a salon that hasn't started.
   * The CMS opens the setup for it once.
   */
  firstRun: boolean;
}

export interface UpdateOnboardingRequest {
  skip?: OnboardingStepId;
  unskip?: OnboardingStepId;
  /** true: hide it without finishing; false: show the setup again. */
  dismissed?: boolean;
  /** Finish the setup (the last step). Also hides it. */
  finished?: true;
}

// R430: the platform admin page
export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminSession {
  email: string;
  /** ISO timestamp the session ends at. */
  expiresAt: string;
}

export interface AdminTenantSummary {
  id: string;
  name: string;
  subdomain: string;
  timezone: string;
  createdAt: string;
  /** R420: how far the owner got with the guided setup. */
  setup: "in_progress" | "hidden" | "finished";
}
