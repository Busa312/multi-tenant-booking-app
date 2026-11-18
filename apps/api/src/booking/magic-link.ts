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

/** When a visit ending at `endAt` stops being manageable through its link. */
export const linkExpiresAt = (endAt: Date): Date => new Date(endAt.getTime() + MAGIC_LINK_GRACE_MS);

/**
 * A fresh random token, expiring MAGIC_LINK_GRACE_MS after `endAt`. 256 bits,
 * written as base64url (43 URL-safe characters, not 64 hex): the link travels
 * by SMS, where every character counts toward the one 160-character part
 * (R500). Lookups go by hash, so links issued in the old hex form still work.
 */
export function issueToken(endAt: Date): IssuedToken {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    accessTokenHash: hashToken(token),
    accessTokenExpiresAt: linkExpiresAt(endAt),
  };
}
