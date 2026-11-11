import { RateLimitService } from "./rate-limit.service.js";
import type { RedisService } from "../redis/redis.service.js";

// R330: fixed windows in Redis, failing open
const setup = (counts: number[] = [], ttl = 120) => {
  let call = 0;
  const client = {
    incr: jest.fn((_key: string) => Promise.resolve(counts[call++] ?? 1)),
    expire: jest.fn((_key: string, _seconds: number) => Promise.resolve(1)),
    ttl: jest.fn().mockResolvedValue(ttl),
    get: jest.fn().mockResolvedValue("3"),
    del: jest.fn().mockResolvedValue(1),
  };
  const incrementInWindow = jest.fn(async (key: string, window: number) => {
    const count = await client.incr(key);
    await client.expire(key, window);
    return count;
  });
  return { service: new RateLimitService({ client, incrementInWindow } as unknown as RedisService), client, incrementInWindow };
};

describe("RateLimitService", () => {
  it("allows up to the limit and refuses past it, saying when to retry", async () => {
    const { service } = setup([5, 6], 42);

    await expect(service.hit("login:1.2.3.4", 5, 900)).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
    await expect(service.hit("login:1.2.3.4", 5, 900)).resolves.toEqual({ allowed: false, retryAfterSeconds: 42 });
  });

  it("counts and sets the window in one atomic step (RedisService.incrementInWindow)", async () => {
    const { service, incrementInWindow } = setup([1]);

    await service.hit("k", 10, 60);

    expect(incrementInWindow).toHaveBeenCalledWith("rl:k", 60);
  });

  it("fails open when Redis is down — limits lapse, booking and login don't", async () => {
    const { service, client } = setup();
    client.incr.mockRejectedValue(new Error("connection refused"));

    await expect(service.hit("k", 1, 60)).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("peeks without counting, and resets", async () => {
    const { service, client } = setup();

    await expect(service.peek("k")).resolves.toBe(3);
    expect(client.incr).not.toHaveBeenCalled();
    await service.reset("k");
    expect(client.del).toHaveBeenCalledWith("rl:k");
  });
});
