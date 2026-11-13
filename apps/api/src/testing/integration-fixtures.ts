import { randomUUID } from "node:crypto";
import { PrismaClient } from "../../generated/prisma/index.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";

/**
 * The migration owner — bypasses RLS, so it can set up and tear down fixtures
 * across tenants. Never what's under test.
 */
export const ownerClient = () => new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

/** Runs `fn` as if inside a request for `tenantId` (what the middleware/guard would do). */
export function asTenant<T>(context: TenantContextService, tenantId: string, fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    context.runWithNewContext(() => {
      context.update({ tenantId });
      fn().then(resolve, reject);
    });
  });
}

export interface TenantFixture {
  tenantId: string;
  serviceId: string;
  professionalId: string;
}

/** A bookable tenant: one 60-minute service, one professional doing it, open 09–18 every day. */
export async function createTenant(owner: PrismaClient, label: string): Promise<TenantFixture> {
  const tenant = await owner.tenant.create({
    data: { name: `Test ${label}`, timezone: "Asia/Tbilisi", subdomain: `it-${label}-${randomUUID().slice(0, 8)}` },
  });
  const service = await owner.service.create({
    data: { tenantId: tenant.id, name: `Cut ${label}`, durationMinutes: 60, price: "40.00" },
  });
  const professional = await owner.professional.create({ data: { tenantId: tenant.id, name: `Pro ${label}` } });
  await owner.serviceProfessional.create({
    data: { tenantId: tenant.id, serviceId: service.id, professionalId: professional.id },
  });
  await owner.businessHours.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      tenantId: tenant.id,
      dayOfWeek,
      startTime: new Date("1970-01-01T09:00:00.000Z"),
      endTime: new Date("1970-01-01T18:00:00.000Z"),
    })),
  });
  return { tenantId: tenant.id, serviceId: service.id, professionalId: professional.id };
}

/** Removes a fixture tenant and everything under it, children first (appointment → visit is RESTRICT). */
export async function dropTenant(owner: PrismaClient, tenantId: string): Promise<void> {
  await owner.appointmentService.deleteMany({ where: { tenantId } });
  await owner.appointment.deleteMany({ where: { tenantId } });
  await owner.visit.deleteMany({ where: { tenantId } });
  await owner.slotHold.deleteMany({ where: { tenantId } });
  await owner.blockedPhone.deleteMany({ where: { tenantId } });
  await owner.tenant.delete({ where: { id: tenantId } });
}

/** YYYY-MM-DD in Tbilisi, `days` from today. */
export const tbilisiDate = (days: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date(Date.now() + days * 86_400_000));
