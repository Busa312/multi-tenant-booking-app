import type { JwtClaims } from "@booking/shared-types";

/**
 * R320: a CMS session ends after 7 days without use. Every token lasts this
 * long, and a token in use is replaced (SessionRenewalInterceptor) so the 7
 * days count from the last request, not from signing in. A product rule, so
 * it lives here rather than in the environment.
 */
export const SESSION_IDLE_TIMEOUT_SECONDS = 7 * 24 * 60 * 60;

/** R320: and 90 days after signing in, however active — then a fresh sign-in. */
export const SESSION_ABSOLUTE_LIMIT_SECONDS = 90 * 24 * 60 * 60;

/**
 * How old a token gets before a request swaps it for a fresh one. An hour:
 * re-signing on every request would be waste, and an hour is nothing against
 * a week.
 */
export const SESSION_RENEW_AFTER_SECONDS = 60 * 60;

const seconds = (ms: number): number => Math.floor(ms / 1000);

/** When the person signed in. Tokens from before the limit fall back to their own issue time. */
export const signedInAt = (claims: Pick<JwtClaims, "iat" | "authTime">): number => claims.authTime ?? claims.iat;

export function needsRenewal(claims: Pick<JwtClaims, "iat">, nowMs: number): boolean {
  return seconds(nowMs) - claims.iat >= SESSION_RENEW_AFTER_SECONDS;
}

export function pastAbsoluteLimit(claims: Pick<JwtClaims, "iat" | "authTime">, nowMs: number): boolean {
  return seconds(nowMs) - signedInAt(claims) >= SESSION_ABSOLUTE_LIMIT_SECONDS;
}

/** A renewed token's lifetime: 7 days, cut short so it never outlives the 90-day limit. 0 = don't renew. */
export function renewedLifetimeSeconds(claims: Pick<JwtClaims, "iat" | "authTime">, nowMs: number): number {
  const untilLimit = signedInAt(claims) + SESSION_ABSOLUTE_LIMIT_SECONDS - seconds(nowMs);
  return Math.max(0, Math.min(SESSION_IDLE_TIMEOUT_SECONDS, untilLimit));
}
