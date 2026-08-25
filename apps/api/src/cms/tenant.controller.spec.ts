import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/index.js";
import { TenantController } from "./tenant.controller.js";
import type { RevalidationService } from "./revalidation.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";

/**
 * The tenant-config write path, which had no test at all.
 *
 * What earns the file is the merge semantics: `/config`'s shallow spread and
 * `/colors`'s one-level-deeper spread and `/seo`'s replace-the-sub-object are
 * three different rules living in one `mutateConfig`, and until now every one of
 * them was guaranteed only by a comment.
 */

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

type StoredConfig = Record<string, unknown>;

const setup = (currentConfig: StoredConfig = {}) => {
  const stored = { configJson: currentConfig };

  const tx = {
    // The row lock mutateConfig takes before reading; irrelevant here beyond
    // needing to resolve.
    $queryRaw: jest.fn().mockResolvedValue([{ id: TENANT_ID }]),
    tenant: {
      findUniqueOrThrow: jest.fn(() =>
        Promise.resolve({
          id: TENANT_ID,
          name: "Acme Salon",
          timezone: "Asia/Tbilisi",
          subdomain: "acme",
          customDomain: null,
          domainVerifiedAt: null,
          configJson: stored.configJson,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        }),
      ),
      update: jest.fn(({ data }: { data: { configJson: StoredConfig } }) => {
        stored.configJson = data.configJson;
        return Promise.resolve({
          id: TENANT_ID,
          name: "Acme Salon",
          timezone: "Asia/Tbilisi",
          subdomain: "acme",
          customDomain: null,
          domainVerifiedAt: null,
          configJson: data.configJson,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        });
      }),
    },
  };

  const prisma = {
    forTenant: jest.fn((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      fn(tx as unknown as Prisma.TransactionClient),
    ),
  } as unknown as PrismaService;
  const tenantContext = { current: { tenantId: TENANT_ID } } as unknown as TenantContextService;
  const revalidation = { revalidateTenant: jest.fn().mockResolvedValue(undefined) };

  return {
    controller: new TenantController(prisma, tenantContext, revalidation as unknown as RevalidationService),
    tx,
    revalidation,
  };
};

/** The config the controller actually wrote. */
const written = (tx: ReturnType<typeof setup>["tx"]): StoredConfig => {
  const call = tx.tenant.update.mock.calls[0];
  if (!call) throw new Error("expected tenant.update to have been called");
  return call[0].data.configJson;
};

describe("TenantController.updateConfig", () => {
  // The generic config endpoint can write `seo`/`business` too, so it has to
  // apply the same rules — otherwise the dedicated endpoint's validation is
  // merely the polite path in, not the enforced one.
  it("rejects an seo payload the dedicated endpoint would reject", async () => {
    const { controller } = setup();

    await expect(controller.updateConfig({ seo: { ogImageUrl: "http://insecure.test/a.png" } })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("rejects angle brackets routed through the generic endpoint", async () => {
    const { controller } = setup();

    await expect(controller.updateConfig({ seo: { description: "</script><script>x</script>" } })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("rejects invalid business coordinates routed through the generic endpoint", async () => {
    const { controller } = setup();

    await expect(controller.updateConfig({ business: { latitude: 999, longitude: 1 } })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("still writes a valid config through", async () => {
    const { controller, tx } = setup({ colors: { primary: "#2563EB" } });

    await controller.updateConfig({ seo: { title: "Acme" } });

    expect(written(tx)).toMatchObject({ seo: { title: "Acme" }, colors: { primary: "#2563EB" } });
  });
});

describe("TenantController.updateSeo", () => {
  it("stores the validated seo object", async () => {
    const { controller, tx } = setup();

    await controller.updateSeo({ title: "Acme Salon", description: "Cuts and colour." }, undefined);

    expect(written(tx).seo).toEqual({ title: "Acme Salon", description: "Cuts and colour." });
  });

  // The whole reason this endpoint exists instead of reusing PATCH /config,
  // whose shallow top-level spread would drop sibling keys.
  it("leaves colors and every other config key untouched", async () => {
    const { controller, tx } = setup({
      colors: { primary: "#2563EB" },
      logoUrl: "https://cdn.example.com/logo.png",
      enabledLocales: ["ka"],
    });

    await controller.updateSeo({ title: "Acme Salon" }, undefined);

    expect(written(tx)).toMatchObject({
      colors: { primary: "#2563EB" },
      logoUrl: "https://cdn.example.com/logo.png",
      enabledLocales: ["ka"],
    });
  });

  // Replace, not merge — a merge cannot express deletion, so a tenant could
  // never clear a description they had typed.
  it("replaces the stored seo object wholesale rather than merging into it", async () => {
    const { controller, tx } = setup({ seo: { title: "Old", description: "Old description" } });

    await controller.updateSeo({ title: "New" }, undefined);

    expect(written(tx).seo).toEqual({ title: "New" });
  });

  it("clears a field the form sent empty", async () => {
    const { controller, tx } = setup({ seo: { title: "Old", description: "Old description" } });

    await controller.updateSeo({ title: "New", description: "" }, undefined);

    expect(written(tx).seo).not.toHaveProperty("description");
  });

  it("stores business info alongside seo without either clobbering the other", async () => {
    const { controller, tx } = setup({ seo: { title: "Kept" } });

    await controller.updateSeo(undefined, { city: "Tbilisi" });

    expect(written(tx)).toMatchObject({ seo: { title: "Kept" }, business: { city: "Tbilisi" } });
  });

  it("writes both sub-objects in one transaction when both are sent", async () => {
    const { controller, tx } = setup();

    await controller.updateSeo({ title: "Acme" }, { city: "Tbilisi" });

    expect(tx.tenant.update).toHaveBeenCalledTimes(1);
    expect(written(tx)).toMatchObject({ seo: { title: "Acme" }, business: { city: "Tbilisi" } });
  });

  it("rejects a request that changes nothing", async () => {
    const { controller } = setup();

    await expect(controller.updateSeo(undefined, undefined)).rejects.toThrow("send seo, business, or both");
  });

  it("rejects an invalid payload before taking the row lock", async () => {
    const { controller, tx } = setup();

    await expect(controller.updateSeo({ ogImageUrl: "http://insecure.example.com/a.png" }, undefined)).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  // The public site's <head> is rendered from a host-tagged cache entry; without
  // this the save would not show up until the 60s TTL lapsed.
  it("revalidates the public site after a successful save", async () => {
    const { controller, revalidation } = setup();

    await controller.updateSeo({ title: "Acme" }, undefined);

    expect(revalidation.revalidateTenant).toHaveBeenCalledWith(expect.objectContaining({ subdomain: "acme" }));
  });

  it("takes a row lock before reading the config it merges into", async () => {
    const { controller, tx } = setup();

    await controller.updateSeo({ title: "Acme" }, undefined);

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.tenant.findUniqueOrThrow.mock.invocationCallOrder[0]!,
    );
  });
});
