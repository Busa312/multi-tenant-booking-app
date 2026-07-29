// Entity shapes mirroring the Prisma schema in apps/api/prisma/schema.prisma.
// Kept as plain interfaces (not generated from Prisma) so cms/public-site
// don't need a Prisma client dependency just to get types.

export type TenantUserRole = "owner" | "professional";

export type AppointmentStatus = "booked" | "cancelled" | "completed" | "no_show";

import type { TenantColors } from "./colors";

export interface Tenant {
  id: string;
  name: string;
  timezone: string;
  subdomain: string;
  customDomain: string | null;
  domainVerifiedAt: string | null;
  configJson: TenantConfig;
  createdAt: string;
}

export interface TenantConfig {
  logoUrl?: string;
  colors?: TenantColors;
  copy?: {
    tagline?: string;
    aboutText?: string;
  };
  // R80: the tenant's public-facing content locales, first entry being the
  // default one that the plain `name`/`description` columns hold. Absent or
  // single-entry = monolingual, which is every tenant today; the CMS only
  // renders per-locale tabs once this lists more than one. Actual per-locale
  // *storage* (JSONB per field) is owned by the Translations feature.
  enabledLocales?: string[];
}

export interface Professional {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export type CmsLoginStatus = "none" | "invited" | "active";

// Returned by GET /cms/professionals only — the public professional listing
// stays the plain Professional shape above.
export interface ProfessionalSummary extends Professional {
  serviceIds: string[];
  cmsLoginStatus: CmsLoginStatus;
  // TenantUser.isActive — independent of Professional.isActive (R60); null
  // when cmsLoginStatus is "none" (no TenantUser row to toggle).
  cmsLoginActive: boolean | null;
  // R80: any appointment ever (not just upcoming) — when true, delete is
  // unavailable client-side (not just rejected server-side), only deactivate.
  hasAppointmentHistory: boolean;
}

export interface TenantUser {
  id: string;
  tenantId: string;
  professionalId: string | null;
  email: string;
  role: TenantUserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  description: string | null; // optional long text, shown on the public site
  durationMinutes: number;
  price: string; // numeric transported as string to avoid float precision loss
  isActive: boolean;
  createdAt: string;
}

// Returned by GET /cms/services only — the public service listing stays the
// plain Service shape above.
export interface ServiceSummary extends Service {
  professionalIds: string[];
  // R70: any appointment ever (not just upcoming) — when true, delete is
  // unavailable client-side (not just rejected server-side), only deactivate.
  hasAppointmentHistory: boolean;
}

export interface ServiceProfessional {
  serviceId: string;
  professionalId: string;
  tenantId: string;
}

export interface BusinessHours {
  id: string;
  tenantId: string;
  professionalId: string | null; // null = applies tenant-wide
  dayOfWeek: number; // 0-6
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

export interface TimeOff {
  id: string;
  tenantId: string;
  professionalId: string | null; // null = whole business closed
  startAt: string;
  endAt: string;
  reason: string | null;
}

export interface Appointment {
  id: string;
  tenantId: string;
  serviceId: string;
  professionalId: string | null; // null = "any available" was chosen
  userName: string;
  phoneNumber: string;
  email: string;
  startAt: string;
  endAt: string;
  price: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
  // access_token_hash is never sent to clients
}

/**
 * Returned by the CMS appointment endpoints only — the public/magic-link shape
 * stays the plain Appointment above.
 *
 * Everything added here is staff-facing, which is the reason for the split: the
 * magic link hands a *customer* an Appointment, and internal notes ("difficult
 * client") plus the id of the staff member who took the call are not theirs to
 * read. The joined names ride along too, so a calendar row renders without a
 * second round trip per appointment.
 */
export interface AppointmentSummary extends Appointment {
  // null = the customer booked it on the public site; set = staff created it
  // from the CMS (TenantUser.id), which is also why it carries no magic link.
  createdByUserId: string | null;
  notes: string | null;
  serviceName: string;
  serviceDurationMinutes: number;
  professionalName: string | null;
  // Whether a customer magic link exists at all for this appointment — derived
  // from access_token_hash, which itself is never sent to clients. True only for
  // public-site bookings, and the flag the CMS uses to warn that rescheduling
  // will invalidate the customer's existing link (R110). Expiry isn't
  // considered: a stale link the customer may still be holding is exactly the
  // one worth warning about.
  hasMagicLink: boolean;
}

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  professionalId: string | null;
}
