import type { Prisma } from "../../generated/prisma/index.js";
import type { Appointment, Professional, Service, Tenant, TenantConfig, TimeOff } from "@booking/shared-types";

// Prisma returns Date/Decimal; shared-types (the wire contract) uses strings
// throughout so JSON.stringify can't silently reformat them. These are the
// single place that conversion happens, rather than casting at each call site.

type PrismaTenant = Prisma.TenantGetPayload<Record<string, never>>;
type PrismaProfessional = Prisma.ProfessionalGetPayload<Record<string, never>>;
type PrismaService = Prisma.ServiceGetPayload<Record<string, never>>;
type PrismaTimeOff = Prisma.TimeOffGetPayload<Record<string, never>>;
type PrismaAppointment = Prisma.AppointmentGetPayload<Record<string, never>>;

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

export const serializeProfessional = (p: PrismaProfessional): Professional => ({
  id: p.id,
  tenantId: p.tenantId,
  name: p.name,
  createdAt: p.createdAt.toISOString(),
});

export const serializeService = (s: PrismaService): Service => ({
  id: s.id,
  tenantId: s.tenantId,
  name: s.name,
  durationMinutes: s.durationMinutes,
  price: s.price.toString(),
  createdAt: s.createdAt.toISOString(),
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
  serviceId: a.serviceId,
  professionalId: a.professionalId,
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
