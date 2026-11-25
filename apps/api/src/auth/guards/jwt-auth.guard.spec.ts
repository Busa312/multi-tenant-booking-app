import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/index.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import type { PrismaService } from "../../prisma/prisma.service.js";
import type { RedisService } from "../../redis/redis.service.js";
import type { TenantContextService } from "../../tenant/tenant-context.service.js";

// R320: a valid signature isn't enough — the session must still be live
const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const NOW = Math.floor(Date.now() / 1000);
const DAY = 24 * 60 * 60;
const claims = { sub: "u1", tenantId: TENANT_ID, role: "owner", jti: "s1", sv: 3, authTime: NOW - DAY, iat: NOW, exp: NOW + 7 * DAY };

const setup = (opts: { revoked?: boolean; user?: { isActive: boolean; sessionVersion: number } | null; claims?: object }) => {
  const passport = Object.getPrototypeOf(JwtAuthGuard.prototype) as { canActivate: () => Promise<boolean> };
  jest.spyOn(passport, "canActivate").mockResolvedValue(true);

  const tx = {
    tenantUser: {
      findFirst: jest.fn().mockResolvedValue(opts.user === undefined ? { isActive: true, sessionVersion: 3 } : opts.user),
    },
  };
  const prisma = {
    forTenant: jest.fn((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx as unknown as Prisma.TransactionClient)),
  } as unknown as PrismaService;
  const redis = { client: { exists: jest.fn().mockResolvedValue(opts.revoked ? 1 : 0) } } as unknown as RedisService;
  const tenantContext = { update: jest.fn() };
  const guard = new JwtAuthGuard(tenantContext as unknown as TenantContextService, prisma, redis);
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ user: opts.claims ?? claims }) }),
  } as unknown as ExecutionContext;
  return { guard, context, tenantContext };
};

afterEach(() => jest.restoreAllMocks());

describe("JwtAuthGuard", () => {
  it("lets a live session through and seeds the tenant context from it", async () => {
    const { guard, context, tenantContext } = setup({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tenantContext.update).toHaveBeenCalledWith({ tenantId: TENANT_ID, role: "owner", professionalId: undefined });
  });

  it("lets a session through until its 90th day", async () => {
    const { guard, context } = setup({ claims: { ...claims, authTime: NOW - 89 * DAY } });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it.each([
    ["a logged-out session", { revoked: true }],
    ["a deactivated login", { user: { isActive: false, sessionVersion: 3 } }],
    ["a session from before a password change", { user: { isActive: true, sessionVersion: 4 } }],
    ["a deleted user", { user: null }],
    ["a token from before sessions were tracked", { claims: { ...claims, jti: undefined, sv: undefined } }],
    // R320: the 90-day limit, however active the session
    ["a session signed in 90 days ago", { claims: { ...claims, authTime: NOW - 90 * DAY } }],
    ["an older token, issued 90 days ago, without a sign-in time", { claims: { ...claims, authTime: undefined, iat: NOW - 90 * DAY } }],
  ])("refuses %s", async (_label, opts) => {
    const { guard, context } = setup(opts);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
