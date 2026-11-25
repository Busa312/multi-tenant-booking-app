import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { of } from "rxjs";
import type { JwtClaims } from "@booking/shared-types";
import { SESSION_ABSOLUTE_LIMIT_SECONDS, SESSION_IDLE_TIMEOUT_SECONDS, needsRenewal } from "./session-lifetime.js";
import { SessionRenewalInterceptor } from "./session-renewal.interceptor.js";

// R320: a session ends after 7 days without use, not 7 days after signing in

const NOW = new Date("2026-11-25T12:00:00.000Z");
const nowSeconds = Math.floor(NOW.getTime() / 1000);

const jwt = new JwtService({ secret: "test-secret", signOptions: { expiresIn: SESSION_IDLE_TIMEOUT_SECONDS } });
const config = { get: () => undefined } as unknown as ConfigService;

const DAY = 24 * 60 * 60;

const claims = (ageSeconds: number, signedInDaysAgo = 1): JwtClaims => ({
  authTime: nowSeconds - signedInDaysAgo * DAY,
  sub: "u-1",
  tenantId: "t-1",
  role: "professional",
  professionalId: "p-1",
  jti: "session-1",
  sv: 3,
  iat: nowSeconds - ageSeconds,
  exp: nowSeconds - ageSeconds + SESSION_IDLE_TIMEOUT_SECONDS,
});

const run = async (user: unknown, url = "/cms/appointments") => {
  const request: { url: string; user?: unknown } = { url, user };
  const reply = { setCookie: jest.fn() };
  const context = {
    getType: () => "http",
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => reply }),
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: jest.fn(() => of("handled")) };
  await new SessionRenewalInterceptor(jwt, config).intercept(context, next);
  return { request, reply, next };
};

// Only the clock: the token signer needs real ticks to finish
beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate", "setTimeout", "queueMicrotask"] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("session renewal", () => {
  it("gives a session in use a fresh 7 days, as the same session with the same claims", async () => {
    const { reply, request } = await run(claims(2 * 60 * 60));

    expect(reply.setCookie).toHaveBeenCalledTimes(1);
    const [name, token, options] = reply.setCookie.mock.calls[0] as [string, string, { expires: Date; httpOnly: boolean }];
    expect(name).toBe("booking_session");
    expect(options.httpOnly).toBe(true);
    expect(options.expires.getTime()).toBe((nowSeconds + SESSION_IDLE_TIMEOUT_SECONDS) * 1000);

    const renewed = jwt.verify<JwtClaims>(token);
    expect(renewed).toMatchObject({ sub: "u-1", tenantId: "t-1", role: "professional", professionalId: "p-1", sv: 3 });
    // Same session id: logging out revokes every copy, a session-version bump ends it
    expect(renewed.jti).toBe("session-1");
    expect(renewed.exp - renewed.iat).toBe(SESSION_IDLE_TIMEOUT_SECONDS);
    // /cms/auth/me reads request.user, so it answers with the new expiry
    expect((request.user as JwtClaims).exp).toBe(renewed.exp);
  });

  // R320: the 90-day limit
  it("keeps the sign-in time, so the 90 days count from signing in", async () => {
    const { reply } = await run(claims(2 * 60 * 60, 30));
    const token = (reply.setCookie.mock.calls[0] as [string, string])[1];
    expect(jwt.verify<JwtClaims>(token).authTime).toBe(nowSeconds - 30 * DAY);
  });

  it("never renews past 90 days from signing in", async () => {
    const { reply } = await run(claims(2 * 60 * 60, 88));
    const [, token, options] = reply.setCookie.mock.calls[0] as [string, string, { expires: Date }];
    const limit = nowSeconds - 88 * DAY + SESSION_ABSOLUTE_LIMIT_SECONDS;
    expect(jwt.verify<JwtClaims>(token).exp).toBe(limit);
    expect(options.expires.getTime()).toBe(limit * 1000);
  });

  it("gives an older token without a sign-in time one, from when it was issued", async () => {
    const { authTime: _authTime, ...older } = claims(2 * 60 * 60);
    const { reply } = await run(older);
    const token = (reply.setCookie.mock.calls[0] as [string, string])[1];
    expect(jwt.verify<JwtClaims>(token).authTime).toBe(older.iat);
  });

  it("leaves a token less than an hour old alone", async () => {
    const { reply } = await run(claims(59 * 60));
    expect(reply.setCookie).not.toHaveBeenCalled();
  });

  it.each([
    ["a request no CMS session got through", undefined, "/cms/appointments"],
    ["claims without a session id", { ...claims(7200), jti: undefined }, "/cms/appointments"],
    ["anything outside /cms", claims(7200), "/admin/api/tenants"],
  ])("does nothing for %s", async (_label, user, url) => {
    const { reply, next } = await run(user, url);
    expect(reply.setCookie).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalled();
  });

  it("renews from an hour on", () => {
    expect(needsRenewal({ iat: nowSeconds - 3599 }, NOW.getTime())).toBe(false);
    expect(needsRenewal({ iat: nowSeconds - 3600 }, NOW.getTime())).toBe(true);
  });
});
