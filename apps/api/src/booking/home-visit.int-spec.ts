import type { ConfigService } from "@nestjs/config";
import { MarketingRebuild } from "../billing/marketing-rebuild.service.js";
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
 * R630 + R260 against the real database: two customers booking home visits
 * whose travel time overlaps — 10:00–11:00 and 11:15–12:15 with 30 min of
 * travel — never both get through, while visits at the business that close
 * together still do.
 */
describe("Concurrent home visits (integration)", () => {
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
    const config = { get: () => undefined } as unknown as ConfigService;
    const billing = new BillingService(prisma, context, new FlittClient(config), new RevalidationService(config), new PlanCatalog(prisma, new MarketingRebuild(config)));
    visits = new VisitService(prisma, context, availability, new BookingService(prisma, context, availability), billing);
    tenant = await createTenant(owner, "home");
    // The fixture's service can be done at the customer's address too; 30 min travel is the default
    await owner.service.update({ where: { id: tenant.serviceId }, data: { place: "either" } });
  });

  afterAll(async () => {
    await dropTenant(owner, tenant.tenantId);
    await prisma.onModuleDestroy();
    await owner.$disconnect();
  });

  const book = (name: string, time: string, place: "business" | "customer", day = 3) =>
    asTenant(context, tenant.tenantId, () =>
      visits.create({
        serviceIds: [tenant.serviceId],
        professionalIds: [tenant.professionalId],
        date: tbilisiDate(day),
        time,
        userName: name,
        phoneNumber: "+995555000630",
        place,
        ...(place === "customer" ? { customerAddress: `${name} street 1` } : {}),
      }),
    );

  it("lets only one of two home visits whose travel time overlaps through", async () => {
    const results = await Promise.allSettled([book("Home A", "10:00", "customer"), book("Home B", "11:15", "customer")]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(refused).toHaveLength(1);
    expect(refused[0]?.reason).toBeInstanceOf(ConflictException);

    const rows = await owner.appointment.findMany({ where: { tenantId: tenant.tenantId, status: "booked" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ place: "customer", travelMinutes: 30 });
  });

  it("still fits the same two times at the business, where nobody travels", async () => {
    const results = await Promise.allSettled([book("Salon A", "10:00", "business", 4), book("Salon B", "11:15", "business", 4)]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
  });
});
