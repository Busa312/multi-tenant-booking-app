import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>("REDIS_URL"));
  }

  async onModuleInit() {
    // ioredis connects lazily on first command; ping here so failures surface at boot.
    await this.client.ping();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
