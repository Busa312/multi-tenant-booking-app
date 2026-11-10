import { createHash, randomBytes } from "node:crypto";

/**
 * Magic-link tokens (R230: one per visit). Only the SHA-256 hash is ever
 * stored; the plaintext exists in the URL the customer receives and nowhere
 * else, so a database leak yields no usable links.
 */

// A link stays usable for a day after the visit's last segment ends.
export const MAGIC_LINK_GRACE_MS = 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedToken {
  token: string;
  accessTokenHash: string;
  accessTokenExpiresAt: Date;
}

/** A fresh random token, expiring MAGIC_LINK_GRACE_MS after `endAt`. */
export function issueToken(endAt: Date): IssuedToken {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    accessTokenHash: hashToken(token),
    accessTokenExpiresAt: new Date(endAt.getTime() + MAGIC_LINK_GRACE_MS),
  };
}
