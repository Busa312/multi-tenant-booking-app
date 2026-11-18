import { createHash, randomBytes } from "node:crypto";

/** R50/R430: how long a set-password link (a staff invite, an owner's link) works. */
export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface InviteToken {
  /** Goes in the link, and nowhere else. */
  token: string;
  /** What is stored (`tenant_user.invite_token_hash`). */
  hash: string;
  expiresAt: Date;
}

/**
 * A fresh set-password token: 32 random bytes, base64url (URL-safe), stored
 * only as its SHA-256. `AuthService.setPassword` consumes it, once.
 */
export function issueInviteToken(now: Date = new Date()): InviteToken {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(now.getTime() + INVITE_TOKEN_TTL_MS),
  };
}

/** The CMS page where the link lands (apps/cms `/set-password/:tenantId/:token`). */
export function setPasswordUrl(cmsUrl: string, tenantId: string, token: string): string {
  return `${cmsUrl}/set-password/${tenantId}/${encodeURIComponent(token)}`;
}
