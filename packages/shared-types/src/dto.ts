// Request/response DTO shapes shared between apps/api and its two clients.

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
