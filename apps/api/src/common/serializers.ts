import type { Prisma } from "../../generated/prisma/index.js";
import type {
  Appointment,
  AppointmentSummary,
  Professional,
  Service,
  Tenant,
  TenantConfig,
  TimeOff,
} from "@booking/shared-types";

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
  isActive: p.isActive,
  createdAt: p.createdAt.toISOString(),
});

export const serializeService = (s: PrismaService): Service => ({
  id: s.id,
  tenantId: s.tenantId,
  name: s.name,
  description: s.description,
  durationMinutes: s.durationMinutes,
  price: s.price.toString(),
  isActive: s.isActive,
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

// The joined shape the CMS appointment list/calendar reads. Staff-only fields
// (notes, who created it) live here rather than on the plain Appointment because
// that one is also what a customer's magic link returns; service and
// professional names come along so a row doesn't need a second lookup, and the
// magic link is reduced to a boolean because the token hash never leaves the API.
export const APPOINTMENT_SUMMARY_INCLUDE = {
  service: { select: { name: true, durationMinutes: true } },
  professional: { select: { name: true } },
} satisfies Prisma.AppointmentInclude;

export type PrismaAppointmentSummary = Prisma.AppointmentGetPayload<{
  include: typeof APPOINTMENT_SUMMARY_INCLUDE;
}>;

export const serializeAppointmentSummary = (a: PrismaAppointmentSummary): AppointmentSummary => ({
  ...serializeAppointment(a),
  createdByUserId: a.createdByUserId,
  notes: a.notes,
  serviceName: a.service.name,
  serviceDurationMinutes: a.service.durationMinutes,
  professionalName: a.professional?.name ?? null,
  hasMagicLink: a.accessTokenHash !== null,
});
