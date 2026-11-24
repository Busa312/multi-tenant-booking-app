import { BadRequestException, ConflictException } from "@nestjs/common";
import type { JwtClaims, SavePushSubscriptionRequest } from "@booking/shared-types";
import { Prisma } from "../../generated/prisma/index.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";
import { isPushServiceEndpoint, PushSubscriptionService } from "./push-subscription.service.js";

// R620: switching a device on and off

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc:def";

const user = { sub: "u-1", tenantId: TENANT_ID, role: "professional", sv: 4 } as JwtClaims;

const request = (overrides: Partial<SavePushSubscriptionRequest> = {}): SavePushSubscriptionRequest => ({
  endpoint: ENDPOINT,
  keys: { p256dh: "BNcR-key_1=", auth: "tBHI-auth" },
  locale: "ka",
  ...overrides,
});

const setup = (existing: { id: string } | null = null) => {
  const tx = {
    pushSubscription: {
      findFirst: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = { forTenant: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) } as unknown as PrismaService;
  const tenantContext = { current: { tenantId: TENANT_ID } } as unknown as TenantContextService;
  return { service: new PushSubscriptionService(prisma, tenantContext), tx };
};

describe("saving a device", () => {
  it("stores it for the caller, stamped with their session version", async () => {
    const { service, tx } = setup();
    await service.save(user, request(), "Mozilla/5.0 (iPhone)");

    expect(tx.pushSubscription.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT_ID,
        endpoint: ENDPOINT,
        tenantUserId: "u-1",
        p256dh: "BNcR-key_1=",
        auth: "tBHI-auth",
        locale: "ka",
        sessionVersion: 4,
        userAgent: "Mozilla/5.0 (iPhone)",
      },
    });
  });

  it("hands a device already known here to whoever switched it on now", async () => {
    const { service, tx } = setup({ id: "d-1" });
    await service.save(user, request({ locale: "en" }), undefined);

    expect(tx.pushSubscription.create).not.toHaveBeenCalled();
    expect(tx.pushSubscription.update).toHaveBeenCalledWith({
      where: { id: "d-1", tenantId: TENANT_ID },
      data: expect.objectContaining({ tenantUserId: "u-1", locale: "en", sessionVersion: 4, userAgent: null }),
    });
  });

  it("answers 409 when the browser is still registered under another salon's login", async () => {
    const { service, tx } = setup();
    tx.pushSubscription.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" }),
    );
    await expect(service.save(user, request(), undefined)).rejects.toThrow(ConflictException);
  });

  it.each([
    ["an endpoint that isn't a push service", request({ endpoint: "https://169.254.169.254/latest" })],
    ["plain http", request({ endpoint: "http://fcm.googleapis.com/fcm/send/abc" })],
    ["missing keys", { endpoint: ENDPOINT, locale: "en" } as unknown as SavePushSubscriptionRequest],
    ["an unknown language", request({ locale: "de" as never })],
  ])("refuses %s", async (_label, body) => {
    const { service, tx } = setup();
    await expect(service.save(user, body, undefined)).rejects.toThrow(BadRequestException);
    expect(tx.pushSubscription.create).not.toHaveBeenCalled();
  });
});

describe("removing a device", () => {
  it("only ever removes the caller's own", async () => {
    const { service, tx } = setup();
    await service.remove(user, ENDPOINT);
    expect(tx.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, tenantUserId: "u-1", endpoint: ENDPOINT },
    });
  });

  it("ignores a missing endpoint", async () => {
    const { service, tx } = setup();
    await service.remove(user, undefined);
    expect(tx.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });
});

describe("isPushServiceEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://web.push.apple.com/QGd3",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
    "https://wns2-par02p.notify.windows.com/w/?token=x",
  ])("accepts %s", (endpoint) => {
    expect(isPushServiceEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "https://evil.example/fcm.googleapis.com",
    "https://fcm.googleapis.com.evil.example/x",
    "https://fcm.googleapis.com:8443/x",
    "https://user@fcm.googleapis.com/x",
    "https://localhost/x",
    "not a url",
    42,
  ])("refuses %s", (endpoint) => {
    expect(isPushServiceEndpoint(endpoint)).toBe(false);
  });
});
