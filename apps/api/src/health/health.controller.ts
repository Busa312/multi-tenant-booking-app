import { Controller, Get, HttpCode, ServiceUnavailableException } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";

type Check = "ok" | "down";

/**
 * system_design.md §12a. Outside every tenant route: no Host or JWT needed,
 * and nothing tenant-scoped is touched.
 */
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness: the process is up and serving. Never touches a dependency. */
  @Get()
  @HttpCode(200)
  @ApiOkResponse({ description: "The process is up" })
  live(): { status: "ok" } {
    return { status: "ok" };
  }

  /**
   * Readiness: can this instance serve traffic? Postgres is required — nothing
   * works without it. Redis is reported but doesn't fail the check: every Redis
   * use (cache, limits, codes) degrades rather than breaks when it's down,
   * except phone verification, which a "degraded" status makes visible.
   */
  @Get("ready")
  @ApiOkResponse({ description: "Postgres reachable; Redis reported" })
  async ready(): Promise<{ status: "ok" | "degraded"; postgres: Check; redis: Check }> {
    const [postgres, redis] = await Promise.all([
      this.prisma.ping().then(
        () => "ok" as const,
        () => "down" as const,
      ),
      withTimeout(this.redis.client.ping(), 1000).then(
        () => "ok" as const,
        () => "down" as const,
      ),
    ]);
    if (postgres === "down") {
      throw new ServiceUnavailableException({ status: "down", postgres, redis });
    }
    return { status: redis === "ok" ? "ok" : "degraded", postgres, redis };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}
