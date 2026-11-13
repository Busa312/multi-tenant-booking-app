import type { FastifyReply } from "fastify";

/** R430: the platform admin's session — never sent anywhere but /admin. */
export const ADMIN_COOKIE = "booking_admin";

export interface AdminCookieConfig {
  /** HTTPS only; on everywhere but local development. */
  secure: boolean;
}

export function adminCookieConfig(env: (key: string) => string | undefined): AdminCookieConfig {
  return { secure: env("NODE_ENV") === "production" || env("COOKIE_SECURE") === "true" };
}

/**
 * httpOnly: the page's script never sees it. SameSite=Strict always — the
 * admin page and its API share one origin, so nothing needs it relaxed. Path
 * /admin: the CMS and public endpoints never receive it.
 */
export function setAdminCookie(reply: FastifyReply, token: string, expiresAt: Date, config: AdminCookieConfig): void {
  reply.setCookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: config.secure,
    sameSite: "strict",
    path: "/admin",
    expires: expiresAt,
  });
}

export function clearAdminCookie(reply: FastifyReply, config: AdminCookieConfig): void {
  reply.clearCookie(ADMIN_COOKIE, { httpOnly: true, secure: config.secure, sameSite: "strict", path: "/admin" });
}
