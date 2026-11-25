

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
  // R220: longest gap, in minutes, between consecutive segments of a visit
  maxVisitGapMinutes: number;
  // R280–R300: what customers may do online
  minBookingNoticeMinutes: number;
  maxBookingAdvanceDays: number;
  changeCutoffHours: number;
  // R440: false = the booking site never offers or names a professional
  customersChooseProfessional: boolean;
  // R610: hours before a visit its reminder text goes out; 0 = off
  reminderHoursBefore: number;
  /**
   * R490: the salon's subscription has lapsed, so its booking site takes no new
   * online bookings. Only on `GET /public/tenant`.
   */
  bookingPaused?: boolean;
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
  cityI18n: LocalizedText | null;
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

/**
 * R240: what the public site needs to know about a professional — including
 * which services they perform, so the booking flow can hide services nobody
 * performs and offer only qualified people for each service.
 */
export interface PublicProfessional extends Professional {
  serviceIds: string[];
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
  /** R520: `price` is a starting price ("from 15 ₾"). */
  priceFrom: boolean;
  /** R510: null = uncategorized. */
  categoryId: string | null;
  /** R510: order within its category. */
  position: number;
  isActive: boolean;
  createdAt: string;
}

/** R510: how a salon groups its price list, in its own order. */
export interface ServiceCategory {
  id: string;
  name: string;
  nameI18n: LocalizedText | null;
  position: number;
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
  /** R460: a professional's weekday off (times are "00:00"). Never true on a tenant-wide row. */
  isDayOff: boolean;
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
  // R160: the service's translations, for showing `name` in the visitor's language
  nameI18n: LocalizedText | null;
  durationMinutes: number;
  price: string;
  /** R520: booked at a starting price. */
  priceFrom: boolean;
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

/** R390: one weekday the salon is open, for visitors. Closed days are simply absent. */
export interface OpeningHours {
  /** 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  /** "HH:mm" on the salon's clock. */
  opens: string;
  closes: string;
}

/** R380: a phone number one salon has stopped from booking online. Never visible to another salon. */
export interface BlockedPhone {
  id: string;
  /** As staff entered it. */
  phoneNumber: string;
  reason: string | null;
  createdAt: string;
}

/**
 * R360: how the customer's latest finished visits (at most three, before this
 * appointment) went. Derived from appointments a person marked completed or
 * no-show; never stored.
 */
export interface NoShowHistory {
  /** How many of those visits the customer didn't come to. */
  missed: number;
  /** How many finished visits were looked at: 1 to 3. */
  of: number;
}

export interface AppointmentSummary extends Appointment {
  // R360: null = no finished visit yet — a new customer is never flagged
  noShowHistory: NoShowHistory | null;
  // R380: this salon has blocked the customer's number from booking online
  phoneBlocked: boolean;
  createdByUserId: string | null;
  notes: string | null;
  professionalName: string | null;
  // R160: translations of the two names, for showing them in the CMS's language
  professionalNameI18n: LocalizedText | null;

  locationName: string | null;
  locationNameI18n: LocalizedText | null;

  hasMagicLink: boolean;
  // R200: the customer visit this appointment is one segment of; null for a
  // staff-created booking. Other segments may belong to other professionals.
  visitId: string | null;
  // R610: when the customer confirmed through their link; null = not (yet)
  confirmedAt: string | null;
}

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  professionalId: string | null;
}

/**
 * R200: one planned appointment of a visit — who performs which services, and
 * when. Consecutive services by the same professional with no gap between them
 * share one segment, exactly as they will share one appointment when booked.
 */
export interface VisitSlotSegment {
  serviceIds: string[];
  professionalId: string;
  startAt: string;
  endAt: string;
}

/**
 * R200: a bookable start time for a whole visit, with the plan behind it.
 * `segments` follow the customer's service order; gaps between them are at
 * most the tenant's `maxVisitGapMinutes` (R220).
 */
export interface VisitSlot {
  startAt: string;
  endAt: string;
  segments: VisitSlotSegment[];
}

/** R200: one appointment of a visit, as the customer's manage page shows it. */
export interface VisitSegment {
  appointmentId: string;
  services: AppointmentServiceLine[];
  professionalId: string | null;
  professionalName: string | null;
  // R160
  professionalNameI18n: LocalizedText | null;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
}

/**
 * R230: a customer booking as a unit — what the magic link manages. `status`
 * is derived: "cancelled" only when every segment is, otherwise "booked" while
 * any segment still is, else the first segment's status.
 */
export interface Visit {
  id: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  price: string;
  /** R520: some service in it was booked at a starting price, so `price` is "from". */
  priceFrom: boolean;
  locationId: string | null;
  locationName: string | null;
  // R160
  locationNameI18n: LocalizedText | null;
  segments: VisitSegment[];
  /** R610: when the customer confirmed they're coming; null = not (yet). Cleared by a move. */
  confirmedAt: string | null;
}
