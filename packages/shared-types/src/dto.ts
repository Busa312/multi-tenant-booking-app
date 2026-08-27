// Request/response DTO shapes shared between apps/api and its two clients.

import type { AppointmentStatus } from "./entities";
import type { TenantColors } from "./colors";

export interface UpdateTenantColorsRequest {
  colors: TenantColors;
}

export interface CreateAppointmentRequest {
  serviceIds: string[];
  professionalId?: string; // omitted = "any available"
  startAt: string;
  userName: string;
  phoneNumber: string;
  email: string;
}

export interface CreateAppointmentResponse {
  appointmentId: string;
  startAt: string;
  endAt: string;
}

export interface RescheduleAppointmentRequest {
  startAt: string;
}

export interface AvailabilityQuery {
  serviceIds: string[];
  professionalId?: string;
  date: string; // "YYYY-MM-DD", in tenant timezone
}

// ---------------------------------------------------------------------------
// CMS-side booking management (staff acting on a customer's behalf).
//
// Wall-clock date + time are sent separately rather than as one instant: the
// tenant's timezone is the authority on what "14:00" means, and the staff
// browser may well be somewhere else. The API resolves them against
// Tenant.timezone, the same way availability's `date` is resolved.
// ---------------------------------------------------------------------------

export interface CmsAvailabilityQuery {
  /** One or more; their durations are booked as one contiguous block. */
  serviceIds: string[];
  /** Forced to the caller's own professional for `professional` logins (R20). */
  professionalId?: string;
  date: string; // "YYYY-MM-DD", in tenant timezone
  /**
   * Set when picking a new time for an existing appointment. It excludes that
   * appointment from the occupancy check so it doesn't block itself (R80), and
   * makes services already on it keep their snapshotted duration — so the slots
   * offered here are the ones the reschedule call will actually accept.
   */
  appointmentId?: string;
}

export interface CmsAppointmentListQuery {
  from?: string; // "YYYY-MM-DD", inclusive, in tenant timezone
  to?: string; // "YYYY-MM-DD", inclusive, in tenant timezone
}

export interface CreateCmsAppointmentRequest {
  /** One or more, in the order they should run. A service may appear only once. */
  serviceIds: string[];
  /** Required for `owner`; ignored for `professional` logins, which are pinned
   *  to their own professional record (R20/R30). */
  professionalId?: string;
  date: string; // "YYYY-MM-DD", in tenant timezone
  time: string; // "HH:mm", in tenant timezone
  userName: string;
  phoneNumber: string;
  email?: string;
  notes?: string;
  /** R60: acknowledge the conflicts a 409 named and book anyway. */
  override?: boolean;
}

/**
 * Every in-place edit of an existing appointment: its time, its professional,
 * its services, or any combination. Send at least one of them.
 *
 * Not named "reschedule" any more because changing the service list also changes
 * the appointment's duration and price, which a reschedule never did.
 */
export interface UpdateCmsAppointmentRequest {
  /** date and time move together — send both or neither. */
  date?: string;
  time?: string;
  professionalId?: string;
  /**
   * Replaces the whole list. Services already on the appointment keep the price
   * and duration they were booked at; only newly added ones are quoted at
   * today's values (R40).
   */
  serviceIds?: string[];
  override?: boolean;
}

// R100: no automatic transition ever happens, so `cancelled` is deliberately
// not settable here — that has its own endpoint, and coming *back* to `booked`
// is how a mis-marked appointment is fixed.
export interface UpdateAppointmentStatusRequest {
  status: Exclude<AppointmentStatus, "cancelled">;
}

export type BookingConflictType = "appointment" | "outside_business_hours" | "time_off";

// R60: staff may book over any of these, but only after confirming a warning
// that names the conflict. Structured rather than prose so the CMS localizes it.
export interface BookingConflict {
  type: BookingConflictType;
  professionalName: string | null;
  /** The conflicting appointment's / time-off block's own window, when there is one. */
  startAt: string | null;
  endAt: string | null;
  /** Conflicting appointment's customer name, or a time-off block's reason. */
  detail: string | null;
}

/** Body of the 409 returned by create/reschedule when `override` isn't set. */
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

export interface CreateServiceRequest {
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: string;
  professionalIds: string[];
}

export interface UpdateServiceRequest {
  name?: string;
  description?: string | null;
  durationMinutes?: number;
  price?: string;
  // When provided, fully replaces the service's ServiceProfessional rows.
  professionalIds?: string[];
  // R60: deactivation (and reactivation) — never a hard delete.
  isActive?: boolean;
}

export interface CreateProfessionalRequest {
  name: string;
  serviceIds?: string[];
}

export interface UpdateProfessionalRequest {
  name?: string;
  isActive?: boolean;
  serviceIds?: string[];
}

export interface UpcomingAppointmentCountResponse {
  count: number;
}

export interface InviteProfessionalRequest {
  email: string;
}

// Email delivery is stubbed (no provider integrated yet) — the API returns
// the raw token/expiry so the CMS can display a copyable set-password link
// instead of it actually being emailed.
export interface InviteProfessionalResponse {
  tenantId: string;
  tenantUserId: string;
  email: string;
  token: string;
  expiresAt: string;
}

// tenantId travels alongside the token because tenant_user is RLS-protected
// (fails closed with no tenant context) — the token can't be looked up
// without first scoping to a tenant, the same reason /cms/auth/login takes a
// subdomain. tenantId isn't a secret; the token is the actual credential.
export interface SetPasswordRequest {
  tenantId: string;
  token: string;
  password: string;
}

export interface CreateTimeOffRequest {
  professionalId?: string; // omitted = whole business closed
  startAt: string;
  endAt: string;
  reason?: string;
}

export interface UpsertBusinessHoursRequest {
  professionalId?: string; // omitted = tenant-wide
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

// Staff-only tenant onboarding (system_design.md §9 step 2) — not called by
// either frontend app. Formalizes the internal script that used to create
// Tenant + owner TenantUser by hand into a guarded API endpoint.
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
