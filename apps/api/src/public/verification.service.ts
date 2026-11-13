import { randomBytes, randomInt } from "node:crypto";
import { BadRequestException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { OtpCooldownResponse } from "@booking/shared-types";
import { RedisService } from "../redis/redis.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { hashToken } from "../booking/magic-link.js";
import { phoneKey } from "../common/phone-key.js";

/**
 * Phone verification for public bookings: a one-time code proves the customer
 * owns the number before an appointment is taken in their name.
 *
 * The code goes out by SMS through NotificationService.sendOtp (or comes back
 * as `devCode` while no provider is configured — PublicController decides).
 * Codes are random, stored only as hashes, expire, are attempt-limited and
 * single-use, and verifying issues a separate short-lived token the booking
 * call must present.
 *
 * Redis is the store because a code is ephemeral by definition. Unlike the
 * resend rate limiter, which fails *open* so a Redis outage can't block link
 * recovery, this fails **closed**: if verification state can't be read or
 * written there is no way to know a number was proven, and booking on an
 * unverified number is the thing this exists to prevent.
 */

const CODE_TTL_SECONDS = 5 * 60;
/** Long enough to fill in the form after verifying, short enough to be useless later. */
const TOKEN_TTL_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;
/** Codes requested per number per hour, and per tenant per hour. */
const SEND_WINDOW_SECONDS = 60 * 60;
const MAX_SENDS_PER_PHONE = 5;
const MAX_SENDS_PER_TENANT = 100;
/**
 * At most one code per number per minute. The site's resend button counts the
 * same minute down, but a page refresh resets that; this is what holds.
 */
const RESEND_COOLDOWN_SECONDS = 60;

export interface StartedVerification {
  expiresAt: Date;
  /**
   * The plaintext code, for the caller to text. PublicController hands it
   * back on the response only while no SMS provider is configured.
   */
  devCode: string | null;
}

@Injectable()
export class VerificationService {
  constructor(
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async start(phoneNumber: string): Promise<StartedVerification> {
    const { tenantId } = this.tenantContext.current;
    const phone = this.normalize(phoneNumber);

    // Before the hourly counters, so a too-early retry doesn't spend them —
    // and before a new code exists, so the one already texted keeps working.
    await this.claimSendSlot(tenantId, phone);

    if (!(await this.withinSendLimits(tenantId, phone))) {
      throw new BadRequestException("Too many codes requested for this number. Try again later.");
    }

    // randomInt is the crypto-backed generator; Math.random would make codes
    // predictable from one another, which is the whole game for an attacker.
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

    await this.withRedis(async () => {
      await this.redis.client.set(this.codeKey(tenantId, phone), hashToken(code), "EX", CODE_TTL_SECONDS);
      await this.redis.client.del(this.attemptsKey(tenantId, phone));
    });

    return { expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000), devCode: code };
  }

  /**
   * Returns the single-use token a booking must carry. Every failure answers
   * the same way — a wrong code and an expired one are indistinguishable, so
   * the response can't be used to map which numbers have a code outstanding.
   */
  async verify(phoneNumber: string, code: string): Promise<string> {
    const { tenantId } = this.tenantContext.current;
    const phone = this.normalize(phoneNumber);
    const rejected = new BadRequestException("That code isn't right, or it has expired.");

    return this.withRedis(async () => {
      const attempts = await this.redis.incrementInWindow(this.attemptsKey(tenantId, phone), CODE_TTL_SECONDS);
      if (attempts > MAX_ATTEMPTS) {
        // The code is burned rather than left to be guessed at leisure.
        await this.redis.client.del(this.codeKey(tenantId, phone));
        throw rejected;
      }

      const stored = await this.redis.client.get(this.codeKey(tenantId, phone));
      if (!stored || stored !== hashToken(String(code ?? ""))) {
        throw rejected;
      }

      // Single use: consumed here so the same code can't authorize two bookings.
      await this.redis.client.del(this.codeKey(tenantId, phone));
      await this.redis.client.del(this.attemptsKey(tenantId, phone));

      const token = randomBytes(32).toString("hex");
      await this.redis.client.set(this.tokenKey(tenantId, phone), hashToken(token), "EX", TOKEN_TTL_SECONDS);
      return token;
    });
  }

  /**
   * Consumes the token issued by `verify`, and only for the number it was
   * issued against — otherwise verifying one number would authorize booking
   * under any other.
   */
  async consume(phoneNumber: string, token: string): Promise<void> {
    const { tenantId } = this.tenantContext.current;
    const phone = this.normalize(phoneNumber);
    const key = this.tokenKey(tenantId, phone);

    await this.withRedis(async () => {
      const stored = await this.redis.client.get(key);
      if (!stored || !token || stored !== hashToken(token)) {
        throw new BadRequestException("This phone number hasn't been verified. Request a new code.");
      }
      await this.redis.client.del(key);
    });
  }

  /**
   * The number's canonical spelling (common/phone-key.ts), so "555 12 34 56",
   * "+995 555 12 34 56" and "+995555123456" are one number: one code, and one
   * hourly allowance that respelling the number can't reset.
   */
  private normalize(phoneNumber: string): string {
    const key = phoneKey(String(phoneNumber ?? ""));
    if (key.length < 5) {
      throw new BadRequestException("A valid phone number is required");
    }
    return hashToken(key);
  }

  private codeKey(tenantId: string, phone: string): string {
    return `otp:${tenantId}:${phone}`;
  }

  private attemptsKey(tenantId: string, phone: string): string {
    return `otp-attempts:${tenantId}:${phone}`;
  }

  private tokenKey(tenantId: string, phone: string): string {
    return `otp-verified:${tenantId}:${phone}`;
  }

  /** One send per number per RESEND_COOLDOWN_SECONDS; a 429 with the wait otherwise. */
  private async claimSendSlot(tenantId: string, phone: string): Promise<void> {
    const key = `otp-cooldown:${tenantId}:${phone}`;
    const retryAfterSeconds = await this.withRedis(async () => {
      const claimed = await this.redis.client.set(key, "1", "EX", RESEND_COOLDOWN_SECONDS, "NX");
      if (claimed) return 0;
      const ttl = await this.redis.client.ttl(key);
      return ttl > 0 ? ttl : RESEND_COOLDOWN_SECONDS;
    });
    if (retryAfterSeconds > 0) {
      const body: OtpCooldownResponse = { code: "otp_cooldown", retryAfterSeconds };
      throw new HttpException(body, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /** Per-number first so a blocked number stops spending the tenant's budget. */
  private async withinSendLimits(tenantId: string, phone: string): Promise<boolean> {
    if ((await this.bump(`otp-sends:${tenantId}:${phone}`)) > MAX_SENDS_PER_PHONE) {
      return false;
    }
    return (await this.bump(`otp-sends:${tenantId}`)) <= MAX_SENDS_PER_TENANT;
  }

  private async bump(key: string): Promise<number> {
    return this.withRedis(async () => {
      return this.redis.incrementInWindow(key, SEND_WINDOW_SECONDS);
    });
  }

  /**
   * Fails closed. A Nest HTTP exception is a deliberate answer and passes
   * through; anything else is Redis being unreachable, which must not be
   * mistaken for "verified".
   */
  private async withRedis<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new ServiceUnavailableException("Verification is unavailable right now. Please try again.");
    }
  }
}
