import type { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "./prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";

/**
 * `forTenant` is the single choke point that makes Postgres RLS actually apply
 * to a query, so these assert its guarantees directly: it fails closed without
 * a tenant, it sets `app.tenant_id` inside the same transaction and before the
 * caller's first statement, and it binds the id as a parameter rather than
 * concatenating it into SQL.
 */

const transaction = jest.fn();
const connect = jest.fn();
const disconnect = jest.fn();
const prismaClientConstructor = jest.fn();

jest.mock("../../generated/prisma/index.js", () => ({
  PrismaClient: jest.fn().mockImplementation((options: unknown) => {
    prismaClientConstructor(options);
    return { $connect: connect, $disconnect: disconnect, $transaction: transaction };
  }),
}));

type ExecuteRawArgs = [TemplateStringsArray, ...unknown[]];

/** A transaction client that records the raw statements run against it. */
const fakeTx = () => {
  const executeRaw = jest.fn<Promise<number>, ExecuteRawArgs>().mockResolvedValue(1);
  return { executeRaw, tx: { $executeRaw: executeRaw } as unknown as Prisma.TransactionClient };
};

const inContext = <T>(tenantContext: TenantContextService, fn: () => Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    tenantContext.runWithNewContext(() => {
      fn().then(resolve, reject);
    });
  });

describe("PrismaService", () => {
  let tenantContext: TenantContextService;
  let service: PrismaService;

  beforeEach(() => {
    process.env.APP_DATABASE_URL = "postgresql://app_user@localhost:5432/booking";
    tenantContext = new TenantContextService();
    service = new PrismaService(tenantContext);
  });

  it("connects as the non-owner APP_DATABASE_URL role, not the migration owner", () => {
    // Table owners bypass RLS in Postgres regardless of policies, so connecting
    // with DATABASE_URL here would silently disable tenant isolation.
    expect(prismaClientConstructor).toHaveBeenCalledWith({
      datasourceUrl: "postgresql://app_user@localhost:5432/booking",
    });
  });

  describe("forTenant", () => {
    it("fails closed when no tenant has been resolved", async () => {
      await expect(inContext(tenantContext, () => service.forTenant(async () => "never"))).rejects.toThrow(
        /before tenant_id was resolved/,
      );
      expect(transaction).not.toHaveBeenCalled();
    });

    it("sets app.tenant_id inside the transaction, before the caller's work", async () => {
      const { executeRaw, tx } = fakeTx();
      const order: string[] = [];
      executeRaw.mockImplementation(async () => {
        order.push("set_config");
        return 1;
      });
      transaction.mockImplementation((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx));

      await inContext(tenantContext, async () => {
        tenantContext.update({ tenantId: "11111111-1111-1111-1111-111111111111" });
        await service.forTenant(async () => {
          order.push("query");
        });
      });

      expect(order).toEqual(["set_config", "query"]);
      expect(transaction).toHaveBeenCalledTimes(1);
    });

    it("binds the tenant id as a parameter instead of interpolating it into SQL", async () => {
      const { executeRaw, tx } = fakeTx();
      transaction.mockImplementation((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx));

      await inContext(tenantContext, async () => {
        tenantContext.update({ tenantId: "'; DROP TABLE tenant; --" });
        await service.forTenant(async () => undefined);
      });

      const [strings, ...values] = executeRaw.mock.calls[0] ?? [];
      expect(strings?.join("?")).toBe("SELECT set_config('app.tenant_id', ?, true)");
      expect(values).toEqual(["'; DROP TABLE tenant; --"]);
    });

    it("scopes the setting to the transaction (set_config is_local = true)", async () => {
      // `false` here would leak the tenant id onto the pooled connection and
      // into whichever request picks it up next.
      const { executeRaw, tx } = fakeTx();
      transaction.mockImplementation((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx));

      await inContext(tenantContext, async () => {
        tenantContext.update({ tenantId: "t1" });
        await service.forTenant(async () => undefined);
      });

      expect(executeRaw.mock.calls[0]?.[0]?.at(-1)).toContain("true)");
    });

    it("hands the caller the transaction it configured and returns their value", async () => {
      const findMany = jest.fn().mockResolvedValue([{ id: "a1" }]);
      const { tx } = fakeTx();
      (tx as unknown as Record<string, unknown>).appointment = { findMany };
      transaction.mockImplementation((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx));

      const result = await inContext(tenantContext, async () => {
        tenantContext.update({ tenantId: "t1" });
        return service.forTenant(async (client) => ({
          rows: await client.appointment.findMany({ where: { tenantId: "t1" } }),
        }));
      });

      // Wrapped (to see writes), but every call lands on the configured client.
      expect(findMany).toHaveBeenCalledWith({ where: { tenantId: "t1" } });
      expect(result).toEqual({ rows: [{ id: "a1" }] });
    });

    // system_design.md §8: the availability cache's invalidation hangs off this
    describe("write reporting", () => {
      const run = (work: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        const { tx } = fakeTx();
        (tx as unknown as Record<string, unknown>).appointment = {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({ id: "a1" }),
        };
        transaction.mockImplementation((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx));
        const listener = jest.fn();
        service.onTenantWrite(listener);
        const result = inContext(tenantContext, async () => {
          tenantContext.update({ tenantId: "t1" });
          return service.forTenant(work);
        });
        return { result, listener };
      };

      it("tells listeners which tenant wrote, once the transaction has committed", async () => {
        const { result, listener } = run((tx) => tx.appointment.create({ data: {} as never }));

        await result;

        expect(listener).toHaveBeenCalledWith("t1");
      });

      it("stays quiet for a read-only transaction", async () => {
        const { result, listener } = run((tx) => tx.appointment.findMany());

        await result;

        expect(listener).not.toHaveBeenCalled();
      });

      it("stays quiet when the transaction fails — nothing was committed", async () => {
        const { result, listener } = run(async (tx) => {
          await tx.appointment.create({ data: {} as never });
          throw new Error("rolled back");
        });

        await expect(result).rejects.toThrow("rolled back");
        expect(listener).not.toHaveBeenCalled();
      });
    });

    it("propagates the caller's error so the transaction rolls back", async () => {
      const { tx } = fakeTx();
      transaction.mockImplementation((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx));

      await expect(
        inContext(tenantContext, async () => {
          tenantContext.update({ tenantId: "t1" });
          return service.forTenant(async () => {
            throw new Error("constraint violation");
          });
        }),
      ).rejects.toThrow("constraint violation");
    });

    it("reads the tenant from the ambient context on every call, not once at construction", async () => {
      const { executeRaw, tx } = fakeTx();
      transaction.mockImplementation((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx));

      await inContext(tenantContext, async () => {
        tenantContext.update({ tenantId: "tenant-a" });
        await service.forTenant(async () => undefined);
      });
      await inContext(tenantContext, async () => {
        tenantContext.update({ tenantId: "tenant-b" });
        await service.forTenant(async () => undefined);
      });

      expect(executeRaw.mock.calls.map((call) => call[1])).toEqual(["tenant-a", "tenant-b"]);
    });
  });

  it("connects and disconnects with the Nest lifecycle", async () => {
    await service.onModuleInit();
    expect(connect).toHaveBeenCalledTimes(1);

    await service.onModuleDestroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
