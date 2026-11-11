import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { RedisService } from "../redis/redis.service.js";

const setup = (postgres: boolean, redis: boolean) =>
  new HealthController(
    { ping: postgres ? jest.fn().mockResolvedValue(undefined) : jest.fn().mockRejectedValue(new Error("down")) } as unknown as PrismaService,
    {
      client: { ping: redis ? jest.fn().mockResolvedValue("PONG") : jest.fn().mockRejectedValue(new Error("down")) },
    } as unknown as RedisService,
  );

describe("HealthController", () => {
  it("is alive without touching anything", () => {
    expect(setup(false, false).live()).toEqual({ status: "ok" });
  });

  it("is ready when Postgres and Redis answer", async () => {
    await expect(setup(true, true).ready()).resolves.toEqual({ status: "ok", postgres: "ok", redis: "ok" });
  });

  it("stays ready but says degraded without Redis — everything that uses it degrades rather than breaks", async () => {
    await expect(setup(true, false).ready()).resolves.toEqual({ status: "degraded", postgres: "ok", redis: "down" });
  });

  it("is not ready without Postgres", async () => {
    await expect(setup(false, true).ready()).rejects.toThrow(ServiceUnavailableException);
  });
});
