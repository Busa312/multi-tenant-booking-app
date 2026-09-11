import { randomBytes, randomInt } from "node:crypto";
import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { RedisService } from "../redis/redis.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { hashToken } from "../booking/booking.service.js";

/**
 * Phone verification for public bookings: a one-time code proves the customer
 * owns the number before an appointment is taken in their name.
 *
 * SMS delivery is **mocked** — see NotificationService.sendOtp. The flow around
 * it is real: codes are random, stored only as hashes, expire, are attempt-
 * limited and single-use, and verifying issues a separate short-lived token the
 * booking call must present. Wiring a provider is implementing `sendOtp` and
 * dropping `devCode` from the start response; nothing here changes.
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

export interface StartedVerification {
  expiresAt: Date;
  /**
   * The plaintext code, returned ONLY because no SMS provider is wired in —
   * exactly the arrangement InviteProfessionalResponse uses. It is what makes
   * the flow testable today and it must disappear the moment delivery is real.
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
      const attempts = await this.redis.client.incr(this.attemptsKey(tenantId, phone));
      if (attempts === 1) {
        await this.redis.client.expire(this.attemptsKey(tenantId, phone), CODE_TTL_SECONDS);
      }
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
   * Digits only, so "+995 555 12 34 56" and "+995555123456" are one number.
   * Deliberately not full E.164 parsing — that needs a country context this
   * app doesn't carry, and the value is compared against itself, never dialled.
   */
  private normalize(phoneNumber: string): string {
    const digits = String(phoneNumber ?? "").replace(/\D/g, "");
    if (digits.length < 5) {
      throw new BadRequestException("A valid phone number is required");
    }
    return hashToken(digits);
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

  /** Per-number first so a blocked number stops spending the tenant's budget. */
  private async withinSendLimits(tenantId: string, phone: string): Promise<boolean> {
    if ((await this.bump(`otp-sends:${tenantId}:${phone}`)) > MAX_SENDS_PER_PHONE) {
      return false;
    }
    return (await this.bump(`otp-sends:${tenantId}`)) <= MAX_SENDS_PER_TENANT;
  }

  private async bump(key: string): Promise<number> {
    return this.withRedis(async () => {
      const count = await this.redis.client.incr(key);
      if (count === 1) {
        await this.redis.client.expire(key, SEND_WINDOW_SECONDS);
      }
      return count;
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
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new ServiceUnavailableException("Verification is unavailable right now. Please try again.");
    }
  }
}
