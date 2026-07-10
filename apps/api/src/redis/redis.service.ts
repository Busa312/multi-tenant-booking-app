import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>("REDIS_URL"));
    // An unhandled "error" event on an EventEmitter is fatal to the process.
    // Redis is cache-only here (system_design.md §8) — a connection blip
    // should degrade to a Postgres fallback, not crash the whole API.
    this.client.on("error", (err) => this.logger.error(`Redis connection error: ${err.message}`));
  }

  async onModuleInit() {
    // ioredis connects lazily on first command; ping here so failures surface at boot.
    await this.client.ping();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
