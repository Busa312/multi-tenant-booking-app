import type { ConfigService } from "@nestjs/config";
import { PlanCatalog } from "../billing/plan-catalog.service.js";
import { BillingService } from "../billing/billing.service.js";
import { FlittClient } from "../billing/flitt.client.js";
import { RevalidationService } from "../cms/revalidation.service.js";
import { ConflictException } from "@nestjs/common";
import type { PrismaClient } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { AvailabilityService } from "./availability.service.js";
import type { AvailabilityCacheService } from "./availability-cache.service.js";
import { BookingService } from "./booking.service.js";
import { VisitService } from "./visit.service.js";
import { asTenant, createTenant, dropTenant, ownerClient, tbilisiDate, type TenantFixture } from "../testing/integration-fixtures.js";

/**
 * R260 against the real database: customers arriving at the same instant for
 * the same time. Without the day's lock both pass the availability check and
 * both write; with it exactly one does.
 */
describe("Concurrent bookings (integration)", () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let context: TenantContextService;
  let visits: VisitService;
  let tenant: TenantFixture;

  beforeAll(async () => {
    owner = ownerClient();
    context = new TenantContextService();
    prisma = new PrismaService(context);
    await prisma.onModuleInit();
    const uncached = { get: async () => null, set: async () => undefined } as unknown as AvailabilityCacheService;
    const availability = new AvailabilityService(prisma, context, uncached);
    // R490: the real check, unconfigured — a fixture salon is on its trial
    const config = { get: () => undefined } as unknown as ConfigService;
    const billing = new BillingService(prisma, context, new FlittClient(config), new RevalidationService(config), new PlanCatalog(prisma));
    visits = new VisitService(prisma, context, availability, new BookingService(prisma, context, availability), billing);
    tenant = await createTenant(owner, "race");
  });

  afterAll(async () => {
    await dropTenant(owner, tenant.tenantId);
    await prisma.onModuleDestroy();
    await owner.$disconnect();
  });

  const book = (name: string, time: string) =>
    asTenant(context, tenant.tenantId, () =>
      visits.create({
        serviceIds: [tenant.serviceId],
        professionalIds: [tenant.professionalId],
        date: tbilisiDate(3),
        time,
        userName: name,
        phoneNumber: "+995555000999",
      }),
    );

  it("lets exactly one of several simultaneous bookings for the same time through", async () => {
    const results = await Promise.allSettled([book("Race 1", "10:00"), book("Race 2", "10:00"), book("Race 3", "10:00")]);

    const booked = results.filter((r) => r.status === "fulfilled");
    const refused = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(booked).toHaveLength(1);
    expect(refused).toHaveLength(2);
    for (const r of refused) expect(r.reason).toBeInstanceOf(ConflictException);

    const rows = await owner.appointment.count({ where: { tenantId: tenant.tenantId, status: "booked" } });
    expect(rows).toBe(1);
  });

  it("doesn't serialize away bookings that don't collide", async () => {
    const results = await Promise.allSettled([book("Early", "13:00"), book("Late", "15:00")]);

    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
  });
});
