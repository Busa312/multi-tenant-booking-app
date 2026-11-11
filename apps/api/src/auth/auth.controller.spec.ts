import type { ConfigService } from "@nestjs/config";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthController } from "./auth.controller.js";
import type { AuthService } from "./auth.service.js";
import { SESSION_COOKIE } from "./session-cookie.js";

// R320: the token goes into the cookie and nowhere else
const session = {
  userId: "u1",
  tenantId: "t1",
  role: "owner" as const,
  professionalId: null,
  expiresAt: "2026-11-11T18:00:00.000Z",
};

const setup = () => {
  const auth = {
    login: jest.fn().mockResolvedValue({ token: "the.jwt", session }),
    resetPassword: jest.fn().mockResolvedValue({ token: "the.jwt", session }),
    logoutToken: jest.fn().mockResolvedValue(undefined),
  };
  const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
  const reply = { setCookie: jest.fn(), clearCookie: jest.fn() };
  return {
    controller: new AuthController(auth as unknown as AuthService, config),
    auth,
    reply,
    asReply: reply as unknown as FastifyReply,
  };
};

describe("AuthController", () => {
  it("puts the token in the httpOnly cookie and answers with the session only", async () => {
    const { controller, reply, asReply } = setup();

    const body = await controller.login({ subdomain: "demo", email: "a@b.c", password: "x" }, asReply);

    expect(body).toEqual(session);
    expect(JSON.stringify(body)).not.toContain("the.jwt");
    expect(reply.setCookie).toHaveBeenCalledWith(
      SESSION_COOKIE,
      "the.jwt",
      expect.objectContaining({ httpOnly: true, sameSite: "strict", path: "/cms" }),
    );
  });

  it("signs in the same way after a password reset", async () => {
    const { controller, reply, asReply } = setup();

    await expect(controller.resetPassword({ tenantId: "t1", token: "x", password: "y" }, asReply)).resolves.toEqual(session);
    expect(reply.setCookie).toHaveBeenCalledWith(SESSION_COOKIE, "the.jwt", expect.anything());
  });

  it("describes the current session without the token", () => {
    const { controller } = setup();

    expect(
      controller.me({ sub: "u1", tenantId: "t1", role: "owner", jti: "s1", sv: 0, iat: 0, exp: 1_794_420_000 }),
    ).toEqual({ userId: "u1", tenantId: "t1", role: "owner", professionalId: null, expiresAt: new Date(1_794_420_000_000).toISOString() });
  });

  it("drops the cookie and hands whatever token it held over to be revoked", async () => {
    const { controller, auth, reply, asReply } = setup();
    const request = { cookies: { [SESSION_COOKIE]: "the.jwt" } } as unknown as FastifyRequest;

    await expect(controller.logout(request, asReply)).resolves.toBe(true);

    expect(reply.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE, expect.objectContaining({ path: "/cms" }));
    expect(auth.logoutToken).toHaveBeenCalledWith("the.jwt");
  });

  // The review's case: a session already ended elsewhere still gets its cookie cleared
  it("clears the cookie even when there's no live session behind it", async () => {
    const { controller, reply, asReply } = setup();

    await controller.logout({ cookies: {} } as unknown as FastifyRequest, asReply);

    expect(reply.clearCookie).toHaveBeenCalled();
  });
});
