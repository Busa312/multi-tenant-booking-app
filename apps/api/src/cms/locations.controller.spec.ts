import { ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";
import type { BillingService } from "../billing/billing.service.js";
import type { RevalidationService } from "./revalidation.service.js";
import { LocationsController } from "./locations.controller.js";

const TENANT = "11111111-1111-1111-1111-111111111111";

function setup(existing: { isActive: boolean } = { isActive: true }, refuse = false) {
  const row = {
    id: "loc-1",
    tenantId: TENANT,
    name: "Vake",
    nameI18n: null,
    addressLine: "12 Chavchavadze Ave",
    addressLineI18n: null,
    city: null,
    cityI18n: null,
    phone: null,
    latitude: null,
    longitude: null,
    position: 0,
    isActive: true,
    createdAt: new Date(),
    professionals: [],
    _count: { appointments: 0 },
  };
  const tx = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ configJson: {}, subdomain: "demo", customDomain: null, domainVerifiedAt: null }) },
    location: {
      aggregate: jest.fn().mockResolvedValue({ _max: { position: 0 } }),
      create: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue(row),
      findFirst: jest.fn().mockResolvedValue(existing),
    },
  };
  const prisma = { forTenant: (fn: (client: typeof tx) => unknown) => fn(tx) } as unknown as PrismaService;
  const tenantContext = { current: { tenantId: TENANT } } as unknown as TenantContextService;
  const revalidation = { revalidateTenant: jest.fn().mockResolvedValue(undefined) } as unknown as RevalidationService;
  const billing = {
    assertLocationAllowedIn: jest.fn(() => (refuse ? Promise.reject(new ForbiddenException({ code: "plan_location_limit", limit: 1 })) : Promise.resolve())),
  };
  const controller = new LocationsController(prisma, tenantContext, revalidation, billing as unknown as BillingService);
  return { controller, tx, billing };
}

// R540: the plan's limit counts active locations
describe("LocationsController — the plan's location limit", () => {
  it("checks the limit before adding a location, and adds nothing when it's reached", async () => {
    const allowed = setup();
    await allowed.controller.create({ name: "Vake", addressLine: "12 Chavchavadze Ave" });
    expect(allowed.billing.assertLocationAllowedIn).toHaveBeenCalledWith(allowed.tx, TENANT);

    const refused = setup({ isActive: true }, true);
    await expect(refused.controller.create({ name: "Saburtalo", addressLine: "1 Pekini Ave" })).rejects.toThrow(ForbiddenException);
    expect(refused.tx.location.create).not.toHaveBeenCalled();
  });

  it("checks it when a closed location is reopened", async () => {
    const { controller, tx, billing } = setup({ isActive: false }, true);

    await expect(controller.update("loc-1", { isActive: true })).rejects.toThrow(ForbiddenException);
    expect(billing.assertLocationAllowedIn).toHaveBeenCalled();
    expect(tx.location.update).not.toHaveBeenCalled();
  });

  it("doesn't check it for edits, closing, or an already-open location", async () => {
    const { controller, billing } = setup({ isActive: true }, true);

    await controller.update("loc-1", { name: "Vake II" });
    await controller.update("loc-1", { isActive: false });
    await controller.update("loc-1", { isActive: true });
    expect(billing.assertLocationAllowedIn).not.toHaveBeenCalled();
  });
});
