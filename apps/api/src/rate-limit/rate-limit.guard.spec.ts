import { HttpException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RateLimitGuard } from "./rate-limit.guard.js";
import type { RateLimitRule } from "./rate-limit.decorator.js";
import type { ConfigService } from "@nestjs/config";
import type { RateLimitService } from "./rate-limit.service.js";
import type { TenantContextService } from "../tenant/tenant-context.service.js";

// R330
const context = (ip: string, header = jest.fn()) =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ ip, headers: {} }), getResponse: () => ({ header }) }),
  }) as unknown as ExecutionContext;

const setup = (rules: RateLimitRule[] | undefined, allowed: boolean[] = [], tenantId: string | null = null) => {
  let call = 0;
  const limits = { hit: jest.fn(() => Promise.resolve({ allowed: allowed[call++] ?? true, retryAfterSeconds: 30 })) };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(rules) } as unknown as Reflector;
  const tenantContext = { currentOrNull: tenantId ? { tenantId } : null } as unknown as TenantContextService;
  const config = { get: () => undefined } as unknown as ConfigService;
  return { guard: new RateLimitGuard(reflector, limits as unknown as RateLimitService, tenantContext, config), limits };
};

describe("RateLimitGuard", () => {
  it("lets a handler without @RateLimit through untouched", async () => {
    const { guard, limits } = setup(undefined);

    await expect(guard.canActivate(context("1.2.3.4"))).resolves.toBe(true);
    expect(limits.hit).not.toHaveBeenCalled();
  });

  it("counts per rule and per client address", async () => {
    const { guard, limits } = setup([
      { name: "login", max: 20, windowSeconds: 900 },
      { name: "login-day", max: 100, windowSeconds: 86400 },
    ]);

    await guard.canActivate(context("203.0.113.7"));

    expect(limits.hit.mock.calls).toEqual([
      ["login:-:203.0.113.7", 20, 900],
      ["login-day:-:203.0.113.7", 100, 86400],
    ]);
  });

  it("keeps each salon's budget separate for the same visitor", async () => {
    const { guard, limits } = setup([{ name: "availability", max: 120, windowSeconds: 60 }], [], "salon-a");

    await guard.canActivate(context("203.0.113.7"));

    expect(limits.hit).toHaveBeenCalledWith("availability:salon-a:203.0.113.7", 120, 60);
  });

  it("answers 429 with Retry-After once a rule is exhausted", async () => {
    const header = jest.fn();
    const { guard } = setup([{ name: "login", max: 20, windowSeconds: 900 }], [false]);

    const error = await guard.canActivate(context("203.0.113.7", header)).catch((e: unknown) => e);

    expect((error as HttpException).getStatus()).toBe(429);
    expect(header).toHaveBeenCalledWith("Retry-After", "30");
  });
});
