import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/index.js";
import { BlockedPhoneService } from "./blocked-phone.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const NOW = new Date("2026-11-13T08:00:00.000Z");

function setup(blockedKeys: string[] = []) {
  const tx = {
    blockedPhone: {
      findMany: jest.fn(async (args: { where: { phoneKey?: { in: string[] } } }) =>
        blockedKeys.filter((key) => args.where.phoneKey?.in.includes(key) ?? true).map((phoneKey) => ({ phoneKey })),
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "b1", createdAt: NOW, ...data })),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = { forTenant: (fn: (t: typeof tx) => unknown) => fn(tx) } as unknown as PrismaService;
  const tenantContext = { current: { tenantId: TENANT_ID } } as unknown as TenantContextService;
  return { tx, service: new BlockedPhoneService(prisma, tenantContext) };
}

// R380
describe("BlockedPhoneService", () => {
  it("stores the number under one key however it was typed", async () => {
    const { tx, service } = setup();

    const blocked = await service.block({ phoneNumber: " 598 55 05 94 ", reason: "  three no-shows " }, "u1");

    expect(tx.blockedPhone.create).toHaveBeenCalledWith({
      data: { tenantId: TENANT_ID, phoneNumber: "598 55 05 94", phoneKey: "995598550594", reason: "three no-shows", createdByUserId: "u1" },
    });
    expect(blocked).toEqual({ id: "b1", phoneNumber: "598 55 05 94", reason: "three no-shows", createdAt: NOW.toISOString() });
  });

  it("refuses something that isn't a phone number", async () => {
    const { service } = setup();
    await expect(service.block({ phoneNumber: "call me" }, "u1")).rejects.toThrow(BadRequestException);
  });

  it("answers 409 when this salon already blocked the number", async () => {
    const { tx, service } = setup();
    tx.blockedPhone.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "x" }),
    );
    await expect(service.block({ phoneNumber: "598550594" }, "u1")).rejects.toThrow(ConflictException);
  });

  it("matches a blocked number across spellings", async () => {
    const { service } = setup(["995598550594"]);

    expect(await service.isBlocked("+995 598 550 594")).toBe(true);
    expect(await service.isBlocked("598550594")).toBe(true);
    expect(await service.isBlocked("598550595")).toBe(false);
  });

  // The rule this whole feature turns on: a block is one salon's, never the platform's.
  it("only ever looks at, writes to and deletes from its own tenant", async () => {
    const { tx, service } = setup();

    await service.list();
    await service.isBlocked("598550594");
    await service.block({ phoneNumber: "598550594" }, "u1");
    await service.unblock("598550594");

    for (const [args] of tx.blockedPhone.findMany.mock.calls as [{ where: { tenantId?: string } }][]) {
      expect(args.where.tenantId).toBe(TENANT_ID);
    }
    expect(tx.blockedPhone.create.mock.calls[0]?.[0].data.tenantId).toBe(TENANT_ID);
    expect(tx.blockedPhone.deleteMany).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID, phoneKey: "995598550594" } });
  });

  it("stops a blocked number with 403 phone_blocked, and lets any other through", async () => {
    const { service } = setup(["995598550594"]);

    await expect(service.assertNotBlocked("598550595")).resolves.toBeUndefined();
    const error = await service.assertNotBlocked("598550594").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toEqual({ code: "phone_blocked" });
  });
});
