import type { FastifyReply } from "fastify";
import { SESSION_COOKIE, clearSessionCookie, sessionCookieConfig, setSessionCookie } from "./session-cookie.js";

// R320: the cookie's attributes are the security — pin each one
const reply = () => {
  const setCookie = jest.fn();
  const clearCookie = jest.fn();
  return { reply: { setCookie, clearCookie } as unknown as FastifyReply, setCookie, clearCookie };
};

describe("session cookie", () => {
  it("is httpOnly, SameSite=Strict, scoped to /cms and expires with the session", () => {
    const { reply: r, setCookie } = reply();
    const expires = new Date("2026-11-11T18:00:00.000Z");

    setSessionCookie(r, "jwt", expires, sessionCookieConfig(() => undefined));

    expect(setCookie).toHaveBeenCalledWith(SESSION_COOKIE, "jwt", {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      domain: undefined,
      path: "/cms",
      expires,
    });
  });

  it("is Secure in production", () => {
    const config = sessionCookieConfig((key) => (key === "NODE_ENV" ? "production" : undefined));

    expect(config).toEqual({ secure: true, sameSite: "strict", domain: undefined });
  });

  it("forces Secure if SameSite has to be relaxed to none", () => {
    const config = sessionCookieConfig((key) => (key === "COOKIE_SAME_SITE" ? "none" : undefined));

    expect(config.secure).toBe(true);
  });

  it("falls back to strict for a SameSite value it doesn't know", () => {
    expect(sessionCookieConfig((key) => (key === "COOKIE_SAME_SITE" ? "loose" : undefined)).sameSite).toBe("strict");
  });

  it("is cleared with the same scope it was set with", () => {
    const { reply: r, clearCookie } = reply();

    clearSessionCookie(r, sessionCookieConfig((key) => (key === "COOKIE_DOMAIN" ? "example.com" : undefined)));

    expect(clearCookie).toHaveBeenCalledWith(SESSION_COOKIE, expect.objectContaining({ path: "/cms", domain: "example.com" }));
  });
});
