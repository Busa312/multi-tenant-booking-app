

export type TenantUserRole = "owner" | "professional";

export type AppointmentStatus = "booked" | "cancelled" | "completed" | "no_show";

import type { TenantColors } from "./colors";
import type { LocalizedText } from "./i18n";

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
  // R170: the public site's own heading and blurb
  copy?: {
    title?: string;
    titleI18n?: LocalizedText;
    description?: string;
    descriptionI18n?: LocalizedText;
  };
  // R80: the tenant's public-facing content locales

  enabledLocales?: string[];
}

export interface Location {
  id: string;
  tenantId: string;
  name: string;
  nameI18n: LocalizedText | null;
  addressLine: string;
  addressLineI18n: LocalizedText | null;
  city: string | null;
  phone: string | null;

  latitude: string | null;
  longitude: string | null;
  position: number;
  isActive: boolean;
  createdAt: string;
}

export interface LocationSummary extends Location {
  professionalIds: string[];
  // R190: any appointment ever (not just upcoming)

  hasAppointmentHistory: boolean;
}

export interface Professional {
  id: string;
  tenantId: string;
  nameI18n: LocalizedText | null;
  // R180: null = works at every location

  locationId: string | null;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export type CmsLoginStatus = "none" | "invited" | "active";

export interface ProfessionalSummary extends Professional {
  serviceIds: string[];
  cmsLoginStatus: CmsLoginStatus;

  cmsLoginActive: boolean | null;
  // R80: any appointment ever (not just upcoming)

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
  nameI18n: LocalizedText | null;
  description: string | null;
  descriptionI18n: LocalizedText | null;
  durationMinutes: number;
  price: string;
  isActive: boolean;
  createdAt: string;
}

export interface ServiceSummary extends Service {
  professionalIds: string[];
  // R70: any appointment ever (not just upcoming)

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
  professionalId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface TimeOff {
  id: string;
  tenantId: string;
  professionalId: string | null;
  startAt: string;
  endAt: string;
  reason: string | null;
}

export interface AppointmentServiceLine {
  serviceId: string;
  name: string;
  durationMinutes: number;
  price: string;
}

export interface Appointment {
  id: string;
  tenantId: string;

  services: AppointmentServiceLine[];
  professionalId: string | null;
  // R150: the branch booked
  locationId: string | null;
  userName: string;
  phoneNumber: string;
  email: string;
  startAt: string;
  endAt: string;
  price: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;

}

export interface AppointmentSummary extends Appointment {
  createdByUserId: string | null;
  notes: string | null;
  professionalName: string | null;

  locationName: string | null;

  hasMagicLink: boolean;
}

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  professionalId: string | null;
}
