import { SetMetadata } from "@nestjs/common";

export interface RateLimitRule {
  /** Names the counter; one per endpoint (or group of endpoints sharing a budget). */
  name: string;
  max: number;
  windowSeconds: number;
}

export const RATE_LIMIT_KEY = "rate-limit";

/**
 * R330: limits a handler per client address. Several rules may apply at once
 * (e.g. a burst limit and an hourly one). Per-account or per-phone limits sit
 * in the services, where the account is known.
 */
export const RateLimit = (...rules: RateLimitRule[]) => SetMetadata(RATE_LIMIT_KEY, rules);
