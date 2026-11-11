import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "../redis/redis.service.js";

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets — for a Retry-After header. */
  retryAfterSeconds: number;
}

/**
 * R330: fixed-window counters in Redis. Fixed windows (one atomic INCR +
 * EXPIRE NX, RedisService.incrementInWindow) rather than sliding ones: a burst at a window edge can reach twice
 * the limit, which is fine for abuse control and costs one round trip.
 *
 * Fails open: a Redis outage must not take booking or login offline
 * (system_design.md §8). The cost is that limits lapse while Redis is down.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly redis: RedisService) {}

  async hit(key: string, max: number, windowSeconds: number): Promise<RateLimitResult> {
    try {
      const fullKey = `rl:${key}`;
      const count = await this.redis.incrementInWindow(fullKey, windowSeconds);
      if (count <= max) {
        return { allowed: true, retryAfterSeconds: 0 };
      }
      const ttl = await this.redis.client.ttl(fullKey);
      return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
    } catch (error) {
      this.logger.warn(`rate limit check failed open for ${key}: ${String(error)}`);
      return { allowed: true, retryAfterSeconds: 0 };
    }
  }

  /** The current count, without adding to it (0 when unknown or Redis is down). */
  async peek(key: string): Promise<number> {
    try {
      return Number((await this.redis.client.get(`rl:${key}`)) ?? 0);
    } catch {
      return 0;
    }
  }

  /** Forgets a key — e.g. failed logins after a successful one. */
  async reset(key: string): Promise<void> {
    try {
      await this.redis.client.del(`rl:${key}`);
    } catch {
      // Expires on its own.
    }
  }
}
