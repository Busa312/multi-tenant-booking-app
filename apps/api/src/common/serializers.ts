import type { Prisma } from "../../generated/prisma/index.js";
import type {
  Appointment,
  AppointmentServiceLine,
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

// The service lines every appointment shape carries. `orderBy` is not optional:
// without it Postgres returns the lines in whatever order it likes, and a
// calendar card would list "Haircut + Colour" one render and "Colour + Haircut"
// the next.
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

/**
 * The tenant shape for `GET /public/tenant`, which is unauthenticated.
 *
 * `configJson` is a free-form JSONB blob, so passing it through wholesale means
 * anything ever written into it is world-readable. Everything in it today is
 * meant to be public (branding, SEO, the salon's own address), but the blob is
 * the obvious place for a future "internal notes" or "billing plan" key, and by
 * then narrowing this would break consumers. Allowlisting each key now costs
 * nothing and makes leaking a new one a deliberate act.
 */
export const serializePublicTenant = (t: PrismaTenant): Tenant => {
  const full = serializeTenant(t);
  // `?? {}` for the same reason mutateConfig does it: the column is NOT NULL but
  // its *value* can be JSON `null`, which would throw on destructure and 500 an
  // unauthenticated route.
  const { logoUrl, colors, copy, enabledLocales, seo, business } = full.configJson ?? {};
  return {
    ...full,
    configJson: {
      ...(logoUrl === undefined ? {} : { logoUrl }),
      ...(colors === undefined ? {} : { colors }),
      ...(copy === undefined ? {} : { copy }),
      ...(enabledLocales === undefined ? {} : { enabledLocales }),
      ...(seo === undefined ? {} : { seo }),
      ...(business === undefined ? {} : { business }),
    },
  };
};

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
  services: a.services.map(serializeServiceLine),
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
// that one is also what a customer's magic link returns; the professional's name
// comes along so a row doesn't need a second lookup, and the magic link is
// reduced to a boolean because the token hash never leaves the API.
export const APPOINTMENT_SUMMARY_INCLUDE = {
  ...APPOINTMENT_INCLUDE,
  professional: { select: { name: true } },
} satisfies Prisma.AppointmentInclude;

export type PrismaAppointmentSummary = Prisma.AppointmentGetPayload<{
  include: typeof APPOINTMENT_SUMMARY_INCLUDE;
}>;

export const serializeAppointmentSummary = (a: PrismaAppointmentSummary): AppointmentSummary => ({
  ...serializeAppointment(a),
  createdByUserId: a.createdByUserId,
  notes: a.notes,
  professionalName: a.professional?.name ?? null,
  hasMagicLink: a.accessTokenHash !== null,
});
