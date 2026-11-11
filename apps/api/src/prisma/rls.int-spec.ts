import { Prisma, type PrismaClient } from "../../generated/prisma/index.js";
import { PrismaService } from "./prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { asTenant, createTenant, dropTenant, ownerClient, type TenantFixture } from "../testing/integration-fixtures.js";

/**
 * Tenant isolation against the real database, as the real runtime role
 * (system_design.md §4). The unit spec proves forTenant sets app.tenant_id;
 * this proves the policies act on it.
 */
describe("Postgres RLS (integration)", () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let context: TenantContextService;
  let a: TenantFixture;
  let b: TenantFixture;

  beforeAll(async () => {
    owner = ownerClient();
    context = new TenantContextService();
    prisma = new PrismaService(context);
    await prisma.onModuleInit();
    a = await createTenant(owner, "a");
    b = await createTenant(owner, "b");
  });

  afterAll(async () => {
    await dropTenant(owner, a.tenantId);
    await dropTenant(owner, b.tenantId);
    await prisma.onModuleDestroy();
    await owner.$disconnect();
  });

  it("runs as a role that can't bypass RLS", async () => {
    const [role] = await prisma.client.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it("has RLS enabled and a policy on every table that carries tenant_id", async () => {
    const tables = await owner.$queryRaw<{ table: string; rls: boolean; policies: bigint }[]>`
      SELECT c.relname AS table, c.relrowsecurity AS rls,
             (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND EXISTS (SELECT 1 FROM information_schema.columns col
                    WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'tenant_id')`;

    expect(tables.length).toBeGreaterThan(10);
    const unprotected = tables.filter((t) => !t.rls || Number(t.policies) === 0).map((t) => t.table);
    expect(unprotected).toEqual([]);
  });

  it("shows a tenant only its own rows — even a query with no tenant filter at all", async () => {
    const services = await asTenant(context, a.tenantId, () => prisma.forTenant((tx) => tx.service.findMany()));

    expect(services.map((s) => s.id)).toEqual([a.serviceId]);
  });

  it("can't read another tenant's row by its id", async () => {
    const found = await asTenant(context, a.tenantId, () =>
      prisma.forTenant((tx) => tx.service.findUnique({ where: { id: b.serviceId } })),
    );

    expect(found).toBeNull();
  });

  it("can't write a row into another tenant", async () => {
    await expect(
      asTenant(context, a.tenantId, () =>
        prisma.forTenant((tx) =>
          tx.service.create({ data: { tenantId: b.tenantId, name: "Smuggled", durationMinutes: 30, price: "1.00" } }),
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("can't change or delete another tenant's rows", async () => {
    const [updated, deleted] = await asTenant(context, a.tenantId, () =>
      prisma.forTenant(async (tx) => [
        await tx.service.updateMany({ where: { id: b.serviceId }, data: { name: "Hijacked" } }),
        await tx.professional.deleteMany({ where: { id: b.professionalId } }),
      ]),
    );

    expect(updated.count).toBe(0);
    expect(deleted.count).toBe(0);
    await expect(owner.service.findUnique({ where: { id: b.serviceId } })).resolves.toMatchObject({ name: "Cut b" });
  });

  it("fails closed: without a tenant set, the runtime role sees nothing", async () => {
    const rows = await prisma.client.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT count(*) FROM service WHERE id IN (${a.serviceId}::uuid, ${b.serviceId}::uuid)`,
    );

    expect(Number(rows[0]?.count)).toBe(0);
  });

  it("doesn't leak the tenant setting from one transaction into the next on a pooled connection", async () => {
    await asTenant(context, a.tenantId, () => prisma.forTenant((tx) => tx.service.findMany()));

    const rows = await prisma.client.$queryRaw<{ setting: string | null }[]>`
      SELECT NULLIF(current_setting('app.tenant_id', true), '') AS setting`;

    expect(rows[0]?.setting ?? null).toBeNull();
  });
});
