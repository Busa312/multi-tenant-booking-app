import type { ConfigService } from "@nestjs/config";

// The constructor's options and the atomic counter — the parts that decide
// whether a Redis outage degrades or hangs (system_design.md §8).
const multi = { incr: jest.fn().mockReturnThis(), expire: jest.fn().mockReturnThis(), exec: jest.fn() };
const constructed: unknown[][] = [];
jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((...args: unknown[]) => {
    constructed.push(args);
    return { on: jest.fn(), multi: () => multi };
  }),
}));

import { RedisService } from "./redis.service.js";

const config = { getOrThrow: () => "redis://localhost:6379" } as unknown as ConfigService;

describe("RedisService", () => {
  it("fails commands fast while Redis is unreachable instead of queueing and retrying them", () => {
    new RedisService(config);

    expect(constructed.at(-1)?.[1]).toMatchObject({
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      commandTimeout: 1000,
    });
  });

  it("counts and starts the window atomically, never pushing an existing expiry back", async () => {
    multi.exec.mockResolvedValue([
      [null, 3],
      [null, 0],
    ]);
    const service = new RedisService(config);

    await expect(service.incrementInWindow("k", 60)).resolves.toBe(3);
    expect(multi.incr).toHaveBeenCalledWith("k");
    expect(multi.expire).toHaveBeenCalledWith("k", 60, "NX");
  });

  it("surfaces a failed increment so callers can fail open or closed as they choose", async () => {
    multi.exec.mockResolvedValue([[new Error("down"), null]]);
    const service = new RedisService(config);

    await expect(service.incrementInWindow("k", 60)).rejects.toThrow("down");
  });
});
