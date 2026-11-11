import type { Prisma } from "../../generated/prisma/index.js";
import type {
  Appointment,
  AppointmentServiceLine,
  AppointmentSummary,
  LocalizedText,
  Location,
  Professional,
  Service,
  PublicProfessional,
  Tenant,
  TenantConfig,
  TimeOff,
  Visit,
} from "@booking/shared-types";

type PrismaTenant = Prisma.TenantGetPayload<Record<string, never>>;
type PrismaProfessional = Prisma.ProfessionalGetPayload<Record<string, never>>;
type PrismaService = Prisma.ServiceGetPayload<Record<string, never>>;
type PrismaTimeOff = Prisma.TimeOffGetPayload<Record<string, never>>;
type PrismaLocation = Prisma.LocationGetPayload<Record<string, never>>;

export const serializeLocalizedText = (value: Prisma.JsonValue | null): LocalizedText | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
};

export const APPOINTMENT_INCLUDE = {
  services: {
    orderBy: { position: "asc" },
    // R160: the translations travel with the name, so the public site can show it in the visitor's language
    include: { service: { select: { name: true, nameI18n: true } } },
  },
} satisfies Prisma.AppointmentInclude;

type PrismaAppointment = Prisma.AppointmentGetPayload<{ include: typeof APPOINTMENT_INCLUDE }>;

const serializeServiceLine = (line: PrismaAppointment["services"][number]): AppointmentServiceLine => ({
  serviceId: line.serviceId,
  name: line.service.name,
  nameI18n: serializeLocalizedText(line.service.nameI18n),
  durationMinutes: line.durationMinutes,
  price: line.price.toString(),
});

export const serializeTenant = (t: PrismaTenant): Tenant => ({
  id: t.id,
  name: t.name,
  timezone: t.timezone,
  subdomain: t.subdomain,
  customDomain: t.customDomain,
  domainVerifiedAt: t.domainVerifiedAt?.toISOString() ?? null,
  configJson: t.configJson as TenantConfig,
  maxVisitGapMinutes: t.maxVisitGapMinutes,
  minBookingNoticeMinutes: t.minBookingNoticeMinutes,
  maxBookingAdvanceDays: t.maxBookingAdvanceDays,
  changeCutoffHours: t.changeCutoffHours,
  createdAt: t.createdAt.toISOString(),
});

export const serializePublicTenant = (t: PrismaTenant): Tenant => {
  const full = serializeTenant(t);

  const { logoUrl, colors, copy, enabledLocales } = full.configJson ?? {};
  return {
    ...full,
    configJson: {
      ...(logoUrl === undefined ? {} : { logoUrl }),
      ...(colors === undefined ? {} : { colors }),
      ...(copy === undefined ? {} : { copy }),
      ...(enabledLocales === undefined ? {} : { enabledLocales }),
    },
  };
};

export const serializeProfessional = (p: PrismaProfessional): Professional => ({
  id: p.id,
  tenantId: p.tenantId,
  nameI18n: serializeLocalizedText(p.nameI18n),
  locationId: p.locationId,
  name: p.name,
  isActive: p.isActive,
  createdAt: p.createdAt.toISOString(),
});

// R240: the public flow needs to know who performs what
export const serializePublicProfessional = (
  p: PrismaProfessional & { serviceProfessionals: { serviceId: string }[] },
): PublicProfessional => ({
  ...serializeProfessional(p),
  serviceIds: p.serviceProfessionals.map((assignment) => assignment.serviceId),
});

export const serializeService = (s: PrismaService): Service => ({
  id: s.id,
  tenantId: s.tenantId,
  name: s.name,
  nameI18n: serializeLocalizedText(s.nameI18n),
  description: s.description,
  descriptionI18n: serializeLocalizedText(s.descriptionI18n),
  durationMinutes: s.durationMinutes,
  price: s.price.toString(),
  isActive: s.isActive,
  createdAt: s.createdAt.toISOString(),
});

// R160: both halves go over the wire

export const serializeLocation = (l: PrismaLocation): Location => ({
  id: l.id,
  tenantId: l.tenantId,
  name: l.name,
  nameI18n: serializeLocalizedText(l.nameI18n),
  addressLine: l.addressLine,
  addressLineI18n: serializeLocalizedText(l.addressLineI18n),
  city: l.city,
  cityI18n: serializeLocalizedText(l.cityI18n),
  phone: l.phone,
  latitude: l.latitude?.toString() ?? null,
  longitude: l.longitude?.toString() ?? null,
  position: l.position,
  isActive: l.isActive,
  createdAt: l.createdAt.toISOString(),
});

export const serializeTimeOff = (t: PrismaTimeOff): TimeOff => ({
  id: t.id,
  tenantId: t.tenantId,
  professionalId: t.professionalId,
  startAt: t.startAt.toISOString(),
  endAt: t.endAt.toISOString(),
  reason: t.reason,
});

export const serializeAppointment = (a: PrismaAppointment): Appointment => ({
  id: a.id,
  tenantId: a.tenantId,
  services: a.services.map(serializeServiceLine),
  professionalId: a.professionalId,
  locationId: a.locationId,
  userName: a.userName,
  phoneNumber: a.phoneNumber,
  email: a.email,
  startAt: a.startAt.toISOString(),
  endAt: a.endAt.toISOString(),
  price: a.price.toString(),
  status: a.status,
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
});

export const APPOINTMENT_SUMMARY_INCLUDE = {
  ...APPOINTMENT_INCLUDE,
  // R160: translations too, so the CMS shows names in its own language
  professional: { select: { name: true, nameI18n: true } },
  location: { select: { name: true, nameI18n: true } },
  // R230: the link lives on the visit, so that's where "has a link" is read
  visit: { select: { accessTokenHash: true } },
} satisfies Prisma.AppointmentInclude;

export type PrismaAppointmentSummary = Prisma.AppointmentGetPayload<{
  include: typeof APPOINTMENT_SUMMARY_INCLUDE;
}>;

export const serializeAppointmentSummary = (a: PrismaAppointmentSummary): AppointmentSummary => ({
  ...serializeAppointment(a),
  createdByUserId: a.createdByUserId,
  notes: a.notes,
  professionalName: a.professional?.name ?? null,
  professionalNameI18n: serializeLocalizedText(a.professional?.nameI18n ?? null),
  locationName: a.location?.name ?? null,
  locationNameI18n: serializeLocalizedText(a.location?.nameI18n ?? null),
  hasMagicLink: a.visit?.accessTokenHash != null,
  visitId: a.visitId,
});

/** R230: a customer visit with every segment, in time order. */
export const VISIT_INCLUDE = {
  appointments: {
    orderBy: { startAt: "asc" },
    include: {
      ...APPOINTMENT_INCLUDE,
      // R160: translated on the confirmation and manage pages
      professional: { select: { name: true, nameI18n: true } },
      location: { select: { name: true, nameI18n: true } },
    },
  },
} satisfies Prisma.VisitInclude;

export type PrismaVisit = Prisma.VisitGetPayload<{ include: typeof VISIT_INCLUDE }>;

/**
 * Times and price describe what is still happening: segments staff have
 * cancelled drop out of them, unless everything is cancelled, in which case
 * they describe what was booked. Status is derived (R230) — "cancelled" only
 * when every segment is.
 */
export const serializeVisit = (v: PrismaVisit): Visit => {
  const live = v.appointments.filter((appointment) => appointment.status !== "cancelled");
  const shown = live.length > 0 ? live : v.appointments;
  const [first, ...rest] = shown;
  if (!first) {
    throw new Error(`visit ${v.id} has no appointments`);
  }
  const status =
    live.length === 0 ? "cancelled" : live.some((appointment) => appointment.status === "booked") ? "booked" : first.status;

  return {
    id: v.id,
    status,
    startAt: first.startAt.toISOString(),
    endAt: new Date(Math.max(...shown.map((appointment) => appointment.endAt.getTime()))).toISOString(),
    price: rest.reduce((sum, appointment) => sum.plus(appointment.price), first.price).toString(),
    locationId: first.locationId,
    locationName: first.location?.name ?? null,
    locationNameI18n: serializeLocalizedText(first.location?.nameI18n ?? null),
    segments: v.appointments.map((appointment) => ({
      appointmentId: appointment.id,
      services: appointment.services.map(serializeServiceLine),
      professionalId: appointment.professionalId,
      professionalName: appointment.professional?.name ?? null,
      professionalNameI18n: serializeLocalizedText(appointment.professional?.nameI18n ?? null),
      startAt: appointment.startAt.toISOString(),
      endAt: appointment.endAt.toISOString(),
      status: appointment.status,
    })),
  };
};
