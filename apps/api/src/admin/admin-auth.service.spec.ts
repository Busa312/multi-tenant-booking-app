import { HttpException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { AdminAuthService } from "./admin-auth.service.js";
import type { ConfigService } from "@nestjs/config";
import type { RedisService } from "../redis/redis.service.js";
import type { RateLimitService } from "../rate-limit/rate-limit.service.js";

const JWT_SECRET = "test-jwt-secret";
const EMAIL = "admin@platform.test";
const PASSWORD = "correct horse battery staple";
const HASH = bcrypt.hashSync(PASSWORD, 4);

function setup(env: Record<string, string | undefined> = { ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD_HASH: HASH }, allowed = true) {
  const store = new Set<string>();
  const redis = {
    client: {
      set: jest.fn(async (key: string) => void store.add(key)),
      exists: jest.fn(async (key: string) => (store.has(key) ? 1 : 0)),
      del: jest.fn(async (key: string) => void store.delete(key)),
    },
  };
  const limits = { hit: jest.fn().mockResolvedValue({ allowed, retryAfterSeconds: allowed ? 0 : 60 }) };
  const config = {
    get: (key: string) => ({ JWT_SECRET, ...env })[key],
    getOrThrow: (key: string) => ({ JWT_SECRET, ...env })[key],
  } as unknown as ConfigService;
  const service = new AdminAuthService(config, redis as unknown as RedisService, limits as unknown as RateLimitService);
  return { service, redis, limits, store };
}

// R430
describe("AdminAuthService", () => {
  it("doesn't exist without an admin configured", async () => {
    const { service } = setup({ ADMIN_EMAIL: undefined, ADMIN_PASSWORD_HASH: undefined });

    expect(service.enabled).toBe(false);
    await expect(service.login({ email: EMAIL, password: PASSWORD })).rejects.toThrow(NotFoundException);
  });

  it("signs the admin in, whatever the email's case, and holds the session", async () => {
    const { service, store } = setup();

    const { token, session } = await service.login({ email: " Admin@Platform.TEST ", password: PASSWORD });

    expect(session.email).toBe(EMAIL);
    expect(store.size).toBe(1);
    await expect(service.verify(token)).resolves.toMatchObject({ email: EMAIL });
  });

  it("refuses a wrong password or a wrong email with the same answer", async () => {
    const { service } = setup();

    await expect(service.login({ email: EMAIL, password: "nope" })).rejects.toThrow("Wrong email or password");
    await expect(service.login({ email: "someone@else.test", password: PASSWORD })).rejects.toThrow("Wrong email or password");
    await expect(service.login({ email: EMAIL, password: "nope" })).rejects.toThrow(UnauthorizedException);
  });

  it("stops every attempt once too many came in from anywhere", async () => {
    const { service, limits } = setup(undefined, false);

    const error = await service.login({ email: EMAIL, password: PASSWORD }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect(limits.hit).toHaveBeenCalledWith("admin-login:all", expect.any(Number), 3600);
  });

  it("ends the session for good on sign-out", async () => {
    const { service } = setup();
    const { token } = await service.login({ email: EMAIL, password: PASSWORD });

    await service.logout(token);

    await expect(service.verify(token)).resolves.toBeNull();
  });

  it("never takes a CMS session — or any token not signed for the admin — as an admin one", async () => {
    const { service } = setup();
    const cmsToken = new JwtService({ secret: JWT_SECRET }).sign({ typ: "platform-admin", email: EMAIL }, { jwtid: "x" });

    await expect(service.verify(cmsToken)).resolves.toBeNull();
    await expect(service.verify("not-a-token")).resolves.toBeNull();
    await expect(service.verify(undefined)).resolves.toBeNull();
  });

  it("stops honouring sessions once the admin email changes", async () => {
    const first = setup();
    const { token } = await first.service.login({ email: EMAIL, password: PASSWORD });
    const changed = setup({ ADMIN_EMAIL: "new@platform.test", ADMIN_PASSWORD_HASH: HASH });
    // the same Redis, a new configuration
    first.store.forEach((key) => changed.store.add(key));

    await expect(changed.service.verify(token)).resolves.toBeNull();
  });
});
