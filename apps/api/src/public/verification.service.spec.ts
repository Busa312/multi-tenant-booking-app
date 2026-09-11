import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { VerificationService } from "./verification.service.js";
import { hashToken } from "../booking/booking.service.js";
import type { RedisService } from "../redis/redis.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PHONE = "+995 555 12 34 56";

/** An in-memory stand-in for Redis: enough of get/set/del/incr/expire to drive the flow. */
function fakeRedis() {
  const store = new Map<string, string>();
  const client = {
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
      return "OK";
    }),
    del: jest.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
    incr: jest.fn(async (k: string) => {
      const next = Number(store.get(k) ?? 0) + 1;
      store.set(k, String(next));
      return next;
    }),
    expire: jest.fn(async () => 1),
  };
  return { store, service: { client } as unknown as RedisService, client };
}

const setup = () => {
  const redis = fakeRedis();
  const tenantContext = { current: { tenantId: TENANT_ID } } as unknown as TenantContextService;
  return { service: new VerificationService(redis.service, tenantContext), redis };
};

describe("VerificationService", () => {
  it("issues a six-digit code and stores only its hash", async () => {
    const { service, redis } = setup();

    const { devCode } = await service.start(PHONE);

    expect(devCode).toMatch(/^\d{6}$/);
    const stored = [...redis.store.values()];
    expect(stored).toContain(hashToken(devCode as string));
    // The code itself must never be at rest.
    expect(stored).not.toContain(devCode);
  });

  it("verifies a correct code and issues a token the booking can consume", async () => {
    const { service } = setup();
    const { devCode } = await service.start(PHONE);

    const token = await service.verify(PHONE, devCode as string);

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    await expect(service.consume(PHONE, token)).resolves.toBeUndefined();
  });

  it("treats a number as the same however it is punctuated", async () => {
    // "+995 555 12 34 56" and "+995555123456" are one number to a customer, and
    // must be one number here or verifying would never match the booking.
    const { service } = setup();
    const { devCode } = await service.start(PHONE);

    const token = await service.verify("+995555123456", devCode as string);

    await expect(service.consume("995 555 123456", token)).resolves.toBeUndefined();
  });

  it("rejects a wrong code and an expired one identically", async () => {
    const { service } = setup();
    await service.start(PHONE);

    // No code outstanding for this second number at all.
    await expect(service.verify("+995500000000", "000000")).rejects.toThrow("That code isn't right, or it has expired.");
    await expect(service.verify(PHONE, "000000")).rejects.toThrow("That code isn't right, or it has expired.");
  });

  it("burns the code after five wrong attempts", async () => {
    const { service } = setup();
    const { devCode } = await service.start(PHONE);

    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(service.verify(PHONE, "000000")).rejects.toThrow(BadRequestException);
    }
    // Even the right code is now worthless — otherwise the attempt cap would
    // only slow guessing down rather than stop it.
    await expect(service.verify(PHONE, devCode as string)).rejects.toThrow(BadRequestException);
  });

  it("makes a code single-use", async () => {
    const { service } = setup();
    const { devCode } = await service.start(PHONE);
    await service.verify(PHONE, devCode as string);

    await expect(service.verify(PHONE, devCode as string)).rejects.toThrow(BadRequestException);
  });

  it("makes the booking token single-use", async () => {
    const { service } = setup();
    const { devCode } = await service.start(PHONE);
    const token = await service.verify(PHONE, devCode as string);
    await service.consume(PHONE, token);

    await expect(service.consume(PHONE, token)).rejects.toThrow("This phone number hasn't been verified");
  });

  it("won't let a token verified for one number authorize another", async () => {
    const { service } = setup();
    const { devCode } = await service.start(PHONE);
    const token = await service.verify(PHONE, devCode as string);

    await expect(service.consume("+995500000000", token)).rejects.toThrow(
      "This phone number hasn't been verified",
    );
  });

  it("refuses an unverified booking outright", async () => {
    const { service } = setup();

    await expect(service.consume(PHONE, "")).rejects.toThrow("This phone number hasn't been verified");
    await expect(service.consume(PHONE, "a".repeat(64))).rejects.toThrow("This phone number hasn't been verified");
  });

  it("stops sending after five codes to one number", async () => {
    const { service } = setup();

    for (let i = 0; i < 5; i++) {
      await service.start(PHONE);
    }
    await expect(service.start(PHONE)).rejects.toThrow("Too many codes requested");
  });

  it("fails closed when Redis is unreachable", async () => {
    // The opposite of the resend limiter, which fails open: there, a Redis
    // outage must not block link recovery; here, it must not let an unverified
    // number through.
    const { service, redis } = setup();
    redis.client.get.mockRejectedValue(new Error("connection refused"));

    await expect(service.consume(PHONE, "a".repeat(64))).rejects.toThrow(ServiceUnavailableException);
  });

  it("rejects a phone number too short to be one", async () => {
    const { service } = setup();

    await expect(service.start("12")).rejects.toThrow("A valid phone number is required");
  });
});
