import type { Prisma } from "../../generated/prisma/index.js";
import type {
  Appointment,
  AppointmentServiceLine,
  AppointmentSummary,
  LocalizedText,
  Location,
  Professional,
  Service,
  Tenant,
  TenantConfig,
  TimeOff,
} from "@booking/shared-types";

type PrismaTenant = Prisma.TenantGetPayload<Record<string, never>>;
type PrismaProfessional = Prisma.ProfessionalGetPayload<Record<string, never>>;
type PrismaService = Prisma.ServiceGetPayload<Record<string, never>>;
type PrismaTimeOff = Prisma.TimeOffGetPayload<Record<string, never>>;
type PrismaLocation = Prisma.LocationGetPayload<Record<string, never>>;

const serializeLocalizedText = (value: Prisma.JsonValue | null): LocalizedText | null => {
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
    include: { service: { select: { name: true } } },
  },
} satisfies Prisma.AppointmentInclude;

type PrismaAppointment = Prisma.AppointmentGetPayload<{ include: typeof APPOINTMENT_INCLUDE }>;

const serializeServiceLine = (line: PrismaAppointment["services"][number]): AppointmentServiceLine => ({
  serviceId: line.serviceId,
  name: line.service.name,
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
  professional: { select: { name: true } },
  location: { select: { name: true } },
} satisfies Prisma.AppointmentInclude;

export type PrismaAppointmentSummary = Prisma.AppointmentGetPayload<{
  include: typeof APPOINTMENT_SUMMARY_INCLUDE;
}>;

export const serializeAppointmentSummary = (a: PrismaAppointmentSummary): AppointmentSummary => ({
  ...serializeAppointment(a),
  createdByUserId: a.createdByUserId,
  notes: a.notes,
  professionalName: a.professional?.name ?? null,
  locationName: a.location?.name ?? null,
  hasMagicLink: a.accessTokenHash !== null,
});
