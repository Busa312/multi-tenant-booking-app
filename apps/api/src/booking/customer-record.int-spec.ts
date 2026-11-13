import type { PrismaClient } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { summarizeAppointments } from "../common/appointment-summaries.js";
import { APPOINTMENT_SUMMARY_INCLUDE } from "../common/serializers.js";
import { asTenant, createTenant, dropTenant, ownerClient, type TenantFixture } from "../testing/integration-fixtures.js";
import { BlockedPhoneService } from "./blocked-phone.service.js";

/**
 * What one salon knows about a customer stays in that salon — against the real
 * database, as the real runtime role. The same phone number is a no-show and
 * blocked at salon A; salon B must see neither (R360, R380).
 */
describe("customer record isolation (integration)", () => {
  const PHONE = "+995555700001";
  const PHONE_KEY = "995555700001";
  // The same number as a customer might type it at the other salon.
  const PHONE_LOCAL = "555 70 00 01";

  let owner: PrismaClient;
  let prisma: PrismaService;
  let context: TenantContextService;
  let blockedPhones: BlockedPhoneService;
  let a: TenantFixture;
  let b: TenantFixture;

  const appointment = (tenant: TenantFixture, status: "booked" | "no_show", daysFromNow: number) =>
    owner.appointment.create({
      data: {
        tenantId: tenant.tenantId,
        professionalId: tenant.professionalId,
        userName: "Isolation Test",
        phoneNumber: PHONE,
        phoneKey: PHONE_KEY,
        email: "",
        startAt: new Date(Date.now() + daysFromNow * 86_400_000),
        endAt: new Date(Date.now() + daysFromNow * 86_400_000 + 3_600_000),
        price: "40.00",
        status,
      },
    });

  /** The tenant's upcoming booking for PHONE, as its CMS would list it. */
  const upcomingAs = (tenant: TenantFixture) =>
    asTenant(context, tenant.tenantId, () =>
      prisma.forTenant(async (tx) => {
        const rows = await tx.appointment.findMany({
          where: { tenantId: tenant.tenantId, status: "booked" },
          include: APPOINTMENT_SUMMARY_INCLUDE,
        });
        return summarizeAppointments(tx, tenant.tenantId, rows);
      }),
    );

  beforeAll(async () => {
    owner = ownerClient();
    context = new TenantContextService();
    prisma = new PrismaService(context);
    await prisma.onModuleInit();
    blockedPhones = new BlockedPhoneService(prisma, context);
    a = await createTenant(owner, "a");
    b = await createTenant(owner, "b");

    // At salon A the customer missed a visit and has been blocked; both salons have them booked again.
    await appointment(a, "no_show", -7);
    await appointment(a, "booked", 2);
    await appointment(b, "booked", 2);
    await asTenant(context, a.tenantId, () => blockedPhones.block({ phoneNumber: PHONE, reason: "no-show" }, null));
  });

  afterAll(async () => {
    await dropTenant(owner, a.tenantId);
    await dropTenant(owner, b.tenantId);
    await prisma.onModuleDestroy();
    await owner.$disconnect();
  });

  it("shows salon A its own customer's missed visit and block", async () => {
    const [summary] = await upcomingAs(a);

    expect(summary).toMatchObject({ noShowHistory: { missed: 1, of: 1 }, phoneBlocked: true });
  });

  it("shows salon B nothing of what happened at salon A", async () => {
    const [summary] = await upcomingAs(b);

    expect(summary).toMatchObject({ noShowHistory: null, phoneBlocked: false });
  });

  it("blocks the number at salon A only — it books freely at salon B", async () => {
    await expect(asTenant(context, a.tenantId, () => blockedPhones.isBlocked(PHONE_LOCAL))).resolves.toBe(true);
    await expect(asTenant(context, b.tenantId, () => blockedPhones.isBlocked(PHONE))).resolves.toBe(false);
    await expect(asTenant(context, b.tenantId, () => blockedPhones.assertNotBlocked(PHONE))).resolves.toBeUndefined();
  });

  it("keeps each salon's list of blocked numbers to itself", async () => {
    await expect(asTenant(context, a.tenantId, () => blockedPhones.list())).resolves.toHaveLength(1);
    await expect(asTenant(context, b.tenantId, () => blockedPhones.list())).resolves.toEqual([]);
  });

  it("can't be read around the tenant filter: RLS hides salon A's rows from salon B", async () => {
    const [blocks, noShows] = await asTenant(context, b.tenantId, () =>
      prisma.forTenant(async (tx) => [
        await tx.blockedPhone.findMany(),
        await tx.appointment.findMany({ where: { phoneNumber: PHONE, status: "no_show" } }),
      ]),
    );

    expect(blocks).toEqual([]);
    expect(noShows).toEqual([]);
  });

  it("lets salon B block the same number independently, and unblocking there leaves salon A's block alone", async () => {
    await asTenant(context, b.tenantId, () => blockedPhones.block({ phoneNumber: PHONE_LOCAL }, null));
    await expect(asTenant(context, b.tenantId, () => blockedPhones.isBlocked(PHONE))).resolves.toBe(true);

    await asTenant(context, b.tenantId, () => blockedPhones.unblock(PHONE));

    await expect(asTenant(context, b.tenantId, () => blockedPhones.isBlocked(PHONE))).resolves.toBe(false);
    await expect(asTenant(context, a.tenantId, () => blockedPhones.isBlocked(PHONE))).resolves.toBe(true);
  });
});
