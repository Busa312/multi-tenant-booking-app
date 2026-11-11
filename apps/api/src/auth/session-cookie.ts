import type { FastifyReply } from "fastify";

/** R320: the one place the CMS session token lives. */
export const SESSION_COOKIE = "booking_session";

export interface SessionCookieConfig {
  /** Production: Secure (HTTPS only). Off locally, where the CMS runs on http. */
  secure: boolean;
  /**
   * "strict" by default — never sent on a request another site starts. Only
   * relax to "none" if the CMS and API can't share a registrable domain
   * (then Secure is forced, and the X-Requested-With check carries CSRF alone).
   */
  sameSite: "strict" | "lax" | "none";
  /** Unset = this API's host only (the safest scope). */
  domain?: string;
}

export function sessionCookieConfig(env: (key: string) => string | undefined): SessionCookieConfig {
  const sameSite = (env("COOKIE_SAME_SITE") ?? "strict") as SessionCookieConfig["sameSite"];
  return {
    secure: sameSite === "none" || env("NODE_ENV") === "production" || env("COOKIE_SECURE") === "true",
    sameSite: ["strict", "lax", "none"].includes(sameSite) ? sameSite : "strict",
    domain: env("COOKIE_DOMAIN") || undefined,
  };
}

/**
 * httpOnly: no script on the CMS page can read it — what an XSS would steal.
 * Path /cms: never sent to the public endpoints. Expires with the JWT inside.
 */
export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date, config: SessionCookieConfig): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.secure,
    sameSite: config.sameSite,
    domain: config.domain,
    path: "/cms",
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply, config: SessionCookieConfig): void {
  reply.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: config.secure,
    sameSite: config.sameSite,
    domain: config.domain,
    path: "/cms",
  });
}
