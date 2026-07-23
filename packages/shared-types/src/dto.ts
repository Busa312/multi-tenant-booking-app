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
  durationMinutes: number;
  price: string;
  professionalIds: string[];
}

export interface CreateProfessionalRequest {
  name: string;
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
