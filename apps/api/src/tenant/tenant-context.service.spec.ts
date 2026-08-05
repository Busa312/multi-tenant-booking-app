import { TenantContextService } from "./tenant-context.service.js";

/**
 * The whole multi-tenant safety story rests on this store being per-request and
 * never bleeding between concurrent requests, so the isolation cases below
 * matter more than the getters.
 */

/** `runWithNewContext` is callback-style; this bridges it to a promise. */
const inContext = <T>(service: TenantContextService, fn: () => Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    service.runWithNewContext(() => {
      fn().then(resolve, reject);
    });
  });

describe("TenantContextService", () => {
  let service: TenantContextService;

  beforeEach(() => {
    service = new TenantContextService();
  });

  describe("outside a request", () => {
    it("throws from `current` rather than silently running unscoped", () => {
      expect(() => service.current).toThrow(/outside of a request/);
    });

    it("throws from `update`", () => {
      expect(() => service.update({ tenantId: "t1" })).toThrow(/outside of a request/);
    });

    it("returns null from `currentOrNull`", () => {
      expect(service.currentOrNull).toBeNull();
    });
  });

  describe("inside a request", () => {
    it("throws from `current` until a tenant has been resolved", async () => {
      await inContext(service, async () => {
        expect(() => service.current).toThrow(/before tenant_id was resolved/);
      });
    });

    it("returns null from `currentOrNull` until a tenant has been resolved", async () => {
      await inContext(service, async () => {
        expect(service.currentOrNull).toBeNull();
      });
    });

    it("exposes what `update` wrote", async () => {
      await inContext(service, async () => {
        service.update({ tenantId: "t1", role: "owner" });

        expect(service.current).toMatchObject({ tenantId: "t1", role: "owner" });
        expect(service.currentOrNull).toMatchObject({ tenantId: "t1" });
      });
    });

    it("merges successive patches instead of replacing the store", async () => {
      // HostTenantMiddleware sets tenantId, then JwtAuthGuard adds the role to
      // that same store — the second write must not drop the first.
      await inContext(service, async () => {
        service.update({ tenantId: "t1" });
        service.update({ role: "professional", professionalId: "p1" });

        expect(service.current).toMatchObject({ tenantId: "t1", role: "professional", professionalId: "p1" });
      });
    });

    it("keeps the context across an await boundary", async () => {
      await inContext(service, async () => {
        service.update({ tenantId: "t1" });
        await new Promise((resolve) => setImmediate(resolve));

        expect(service.current.tenantId).toBe("t1");
      });
    });
  });

  describe("isolation", () => {
    it("gives interleaved concurrent requests separate stores", async () => {
      const observed = await Promise.all(
        ["t1", "t2", "t3"].map((tenantId, index) =>
          inContext(service, async () => {
            service.update({ tenantId });
            // Stagger the resumptions so the three requests interleave rather
            // than running to completion one at a time.
            await new Promise((resolve) => setTimeout(resolve, (3 - index) * 10));
            return service.current.tenantId;
          }),
        ),
      );

      expect(observed).toEqual(["t1", "t2", "t3"]);
    });

    it("does not let a nested context write back to its parent", async () => {
      await inContext(service, async () => {
        service.update({ tenantId: "outer" });

        await inContext(service, async () => {
          service.update({ tenantId: "inner" });
          expect(service.current.tenantId).toBe("inner");
        });

        expect(service.current.tenantId).toBe("outer");
      });
    });

    it("leaves no context behind once a request finishes", async () => {
      await inContext(service, async () => {
        service.update({ tenantId: "t1" });
      });

      expect(service.currentOrNull).toBeNull();
    });
  });
});
