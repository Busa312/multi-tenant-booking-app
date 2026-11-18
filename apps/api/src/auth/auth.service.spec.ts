import { createHash } from "crypto";
import { BadRequestException, HttpException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { Prisma } from "../../generated/prisma/index.js";
import { AuthService, revokedSessionKey, validatePassword } from "./auth.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { RedisService } from "../redis/redis.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";
import type { TenantResolverService } from "../tenant/tenant-resolver.service.js";
import type { MailService } from "../notifications/mail.service.js";
import type { RateLimitService } from "../rate-limit/rate-limit.service.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const HASH = bcrypt.hashSync("correct horse battery", 4);

const user = (overrides: Record<string, unknown> = {}) => ({
  id: "u1",
  tenantId: TENANT_ID,
  email: "owner@demo.local",
  passwordHash: HASH,
  role: "owner",
  professionalId: null,
  isActive: true,
  sessionVersion: 3,
  ...overrides,
});

interface Overrides {
  user?: ReturnType<typeof user> | null;
  tenantMissing?: boolean;
  limitAllowed?: boolean;
}

const setup = (overrides: Overrides = {}) => {
  const tx = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ name: "Salon <Vake>" }) },
    tenantUser: {
      findFirst: jest.fn().mockResolvedValue(overrides.user === undefined ? user() : overrides.user),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...user(), ...data, sessionVersion: 4 })),
    },
  };
  const prisma = {
    forTenant: jest.fn((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx as unknown as Prisma.TransactionClient)),
  } as unknown as PrismaService;
  const jwt = {
    signAsync: jest.fn().mockResolvedValue("signed"),
    decode: jest.fn().mockReturnValue({ exp: 2_000_000_000 }),
    verifyAsync: jest.fn(),
  };
  const tenantContext = { update: jest.fn() };
  const tenantResolver = {
    resolveTenantIdBySubdomain: overrides.tenantMissing
      ? jest.fn().mockRejectedValue(new Error("unknown"))
      : jest.fn().mockResolvedValue(TENANT_ID),
  };
  const limits = {
    hit: jest.fn().mockResolvedValue({ allowed: overrides.limitAllowed ?? true, retryAfterSeconds: 600 }),
    reset: jest.fn().mockResolvedValue(undefined),
  };
  const redis = { client: { set: jest.fn().mockResolvedValue("OK") } };
  const mail = { send: jest.fn().mockResolvedValue(true) };
  const config = { get: jest.fn((key: string) => (key === "CMS_URL" ? "https://cms.example.com/" : undefined)) };

  const service = new AuthService(
    prisma,
    jwt as unknown as JwtService,
    tenantContext as unknown as TenantContextService,
    tenantResolver as unknown as TenantResolverService,
    limits as unknown as RateLimitService,
    redis as unknown as RedisService,
    mail as unknown as MailService,
    config as unknown as ConfigService,
  );
  return { service, tx, jwt, limits, redis, mail };
};

const login = { subdomain: "demo", email: " Owner@Demo.local ", password: "correct horse battery" };

describe("login", () => {
  it("signs a session carrying the user's session version and a fresh session id (R320)", async () => {
    const { service, jwt } = setup();

    await expect(service.login(login)).resolves.toEqual({
      token: "signed",
      // What the CMS gets: who and until when — never the token
      session: {
        userId: "u1",
        tenantId: TENANT_ID,
        role: "owner",
        professionalId: null,
        expiresAt: new Date(2_000_000_000 * 1000).toISOString(),
      },
    });

    const [claims, options] = jwt.signAsync.mock.calls[0] as [Record<string, unknown>, { jwtid: string }];
    expect(claims).toMatchObject({ sub: "u1", tenantId: TENANT_ID, role: "owner", sv: 3 });
    expect(options.jwtid).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("counts every attempt against the account before checking it, and a right password clears the count (R330)", async () => {
    const { service, limits } = setup();

    await expect(service.login({ ...login, password: "wrong" })).rejects.toThrow(UnauthorizedException);
    expect(limits.hit).toHaveBeenCalledWith(`login-fail:${TENANT_ID}:${sha256("owner@demo.local")}`, 5, 900);
    expect(limits.reset).not.toHaveBeenCalled();

    await service.login(login);
    expect(limits.reset).toHaveBeenCalledWith(`login-fail:${TENANT_ID}:${sha256("owner@demo.local")}`);
  });

  // Count-then-check: simultaneous guesses can't all slip in under the limit
  it("refuses once the count is spent — without even looking the account up", async () => {
    const { service, tx } = setup({ limitAllowed: false });

    const error = await service.login(login).catch((e: unknown) => e);

    expect((error as HttpException).getStatus()).toBe(429);
    expect(tx.tenantUser.findFirst).not.toHaveBeenCalled();
  });

  it("answers an unknown account exactly like a wrong password", async () => {
    const unknownUser = await setup({ user: null }).service.login(login).catch((e: Error) => e.message);
    const unknownBusiness = await setup({ tenantMissing: true }).service.login(login).catch((e: Error) => e.message);
    const wrongPassword = await setup().service.login({ ...login, password: "nope" }).catch((e: Error) => e.message);

    expect(new Set([unknownUser, unknownBusiness, wrongPassword]).size).toBe(1);
  });
});

// R310
describe("forgot password", () => {
  it("stores only the token's hash, for 30 minutes, and emails the link to the account's address", async () => {
    const { service, tx, mail } = setup();

    await service.forgotPassword({ subdomain: "demo", email: "owner@demo.local", locale: "en" });

    const data = tx.tenantUser.update.mock.calls[0]?.[0]?.data as { passwordResetTokenHash: string; passwordResetExpiresAt: Date };
    const sent = mail.send.mock.calls[0]?.[0] as { to: string; content: { subject: string; text: string } };
    const resetUrl = sent.content.text.match(/https:\/\/cms\.example\.com\/reset-password\/\S+/)?.[0] ?? "";
    const token = resetUrl.split("/").at(-1) ?? "";
    expect(sent.to).toBe("owner@demo.local");
    expect(resetUrl.startsWith(`https://cms.example.com/reset-password/${TENANT_ID}/`)).toBe(true);
    expect(data.passwordResetTokenHash).toBe(sha256(token));
    expect(data.passwordResetExpiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 60_000);
    // Names the salon, in the CMS's language
    expect(sent.content.subject).toBe("Reset your password · Salon <Vake>");
  });

  it("writes the email in Georgian unless the CMS was showing English", async () => {
    const { service, mail } = setup();

    await service.forgotPassword({ subdomain: "demo", email: "owner@demo.local" });

    const sent = mail.send.mock.calls[0]?.[0] as { content: { subject: string } };
    expect(sent.content.subject).toMatch(/^პაროლის აღდგენა/);
  });

  it.each([
    ["no such business", { tenantMissing: true }],
    ["no such account", { user: null }],
    ["too many requests for the account", { limitAllowed: false }],
  ])("resolves silently and sends nothing when there's %s", async (_label, overrides) => {
    const { service, mail } = setup(overrides as Overrides);

    await expect(service.forgotPassword({ subdomain: "demo", email: "x@y.z" })).resolves.toBeUndefined();
    expect(mail.send).not.toHaveBeenCalled();
  });
});

describe("reset password", () => {
  it("sets the password, uses up the token and ends every older session", async () => {
    const { service, tx } = setup();

    await service.resetPassword({ tenantId: TENANT_ID, token: "t0ken", password: "a much better one" });

    expect(tx.tenantUser.findFirst.mock.calls[0]?.[0]?.where).toMatchObject({ passwordResetTokenHash: sha256("t0ken") });
    const data = tx.tenantUser.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(await bcrypt.compare("a much better one", data.passwordHash as string)).toBe(true);
    expect(data).toMatchObject({ passwordResetTokenHash: null, passwordResetExpiresAt: null, sessionVersion: { increment: 1 } });
  });

  it("refuses an unknown or expired token", async () => {
    const { service } = setup({ user: null });

    await expect(service.resetPassword({ tenantId: TENANT_ID, token: "x", password: "long enough pass" })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("refuses a tenant id that isn't one, before any query", async () => {
    const { service, tx } = setup();

    await expect(service.resetPassword({ tenantId: "nope", token: "x", password: "long enough pass" })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(tx.tenantUser.findFirst).not.toHaveBeenCalled();
  });
});

describe("password rules", () => {
  it.each(["short", "x".repeat(73), "ა".repeat(25)])("refuses %p", (password) => {
    expect(() => validatePassword(password)).toThrow(BadRequestException);
  });

  it("accepts ten characters up to 72 bytes", () => {
    expect(validatePassword("ten chars!")).toBe("ten chars!");
  });
});

// R320
describe("logout from a cookie", () => {
  it("revokes a token that still verifies", async () => {
    const { service, jwt, redis } = setup();
    jwt.verifyAsync.mockResolvedValue({ sub: "u1", tenantId: TENANT_ID, role: "owner", jti: "s9", sv: 3, iat: 0, exp: Math.floor(Date.now() / 1000) + 60 });

    await service.logoutToken("live.jwt");

    expect(redis.client.set.mock.calls[0]?.[0]).toBe(revokedSessionKey("s9"));
  });

  it("does nothing — and doesn't fail — for a token that's dead, forged or missing", async () => {
    const { service, jwt, redis } = setup();
    jwt.verifyAsync.mockRejectedValue(new Error("invalid signature"));

    await expect(service.logoutToken("forged.jwt")).resolves.toBeUndefined();
    await expect(service.logoutToken(undefined)).resolves.toBeUndefined();
    expect(redis.client.set).not.toHaveBeenCalled();
  });
});

describe("logout", () => {
  const claims = { sub: "u1", tenantId: TENANT_ID, role: "owner" as const, jti: "s1", sv: 3, iat: 0, exp: 0 };

  it("revokes this session until the token would have expired anyway", async () => {
    const { service, redis } = setup();
    const exp = Math.floor(Date.now() / 1000) + 600;

    await service.logout({ ...claims, exp });

    const [key, , mode, ttl] = redis.client.set.mock.calls[0] as [string, string, string, number];
    expect(key).toBe(revokedSessionKey("s1"));
    expect(mode).toBe("EX");
    expect(ttl).toBeGreaterThan(590);
  });

  it("ends every session of the user if Redis can't take the note — logout never silently does nothing", async () => {
    const { service, redis, tx } = setup();
    redis.client.set.mockRejectedValue(new Error("down"));

    await service.logout({ ...claims, exp: Math.floor(Date.now() / 1000) + 600 });

    expect(tx.tenantUser.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { sessionVersion: { increment: 1 } } });
  });
});
