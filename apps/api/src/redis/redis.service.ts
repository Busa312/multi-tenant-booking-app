import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

// Everything Redis backs here degrades rather than breaks without it (cache,
// rate limits, session revocation — system_design.md §8), so a command must
// fail *fast* when Redis is unreachable. ioredis's defaults queue commands
// while reconnecting and retry each ~20 times, which turned "fail open" into
// every request hanging for seconds.
const COMMAND_TIMEOUT_MS = 1000;
const BOOT_TIMEOUT_MS = 10_000;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>("REDIS_URL"), {
      // Don't queue commands while disconnected — reject them at once.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      commandTimeout: COMMAND_TIMEOUT_MS,
    });
    // An unhandled "error" event on an EventEmitter is fatal to the process.
    // Redis is cache-only here (system_design.md §8) — a connection blip
    // should degrade to a Postgres fallback, not crash the whole API.
    this.client.on("error", (err) => this.logger.error(`Redis connection error: ${err.message}`));
  }

  async onModuleInit() {
    // No offline queue, so wait for the connection before the first command;
    // failing here surfaces a wrong REDIS_URL at boot rather than as a slow leak.
    if (this.client.status !== "ready") {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Redis not ready within 10s")), BOOT_TIMEOUT_MS);
        this.client.once("ready", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    await this.client.ping();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * A counter in a fixed window: INCR and the window's expiry in one atomic
   * MULTI. EXPIRE NX sets the expiry only when the key has none — so it can't
   * be pushed back by later hits, and a counter that somehow lost its expiry
   * gets one again on the next hit instead of living forever.
   */
  async incrementInWindow(key: string, windowSeconds: number): Promise<number> {
    const results = await this.client.multi().incr(key).expire(key, windowSeconds, "NX").exec();
    const [error, count] = results?.[0] ?? [new Error("empty MULTI result"), null];
    if (error) throw error;
    return Number(count);
  }
}
