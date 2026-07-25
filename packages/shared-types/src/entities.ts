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
  durationMinutes: number;
  price: string; // numeric transported as string to avoid float precision loss
  createdAt: string;
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

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  professionalId: string | null;
}
