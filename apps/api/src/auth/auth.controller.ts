import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBody, ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  CmsSession,
  ForgotPasswordRequest,
  JwtClaims,
  LoginRequest,
  ResetPasswordRequest,
  SetPasswordRequest,
} from "@booking/shared-types";
import { AuthService, toSession, type IssuedSession } from "./auth.service.js";
import {
  CmsSessionDto,
  ForgotPasswordRequestDto,
  LoginRequestDto,
  ResetPasswordRequestDto,
  SetPasswordRequestDto,
} from "../common/dto.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { CurrentUser } from "./decorators/current-user.decorator.js";
import { RateLimit } from "../rate-limit/rate-limit.decorator.js";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  sessionCookieConfig,
  setSessionCookie,
  type SessionCookieConfig,
} from "./session-cookie.js";

/**
 * R320: every way in sets the session as an httpOnly cookie and answers with
 * the session's description only — the token never appears in a body the
 * CMS's JavaScript could read.
 */
@ApiTags("cms-auth")
@Controller("cms/auth")
export class AuthController {
  private readonly cookie: SessionCookieConfig;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    this.cookie = sessionCookieConfig((key) => config.get<string>(key));
  }

  // R330: per address here; per account inside the service
  @Post("login")
  @HttpCode(200)
  @RateLimit({ name: "login", max: 20, windowSeconds: 15 * 60 })
  @ApiBody({ type: LoginRequestDto })
  @ApiOkResponse({ type: CmsSessionDto, description: "Sets the httpOnly session cookie" })
  async login(@Body() body: LoginRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<CmsSession> {
    return this.start(reply, await this.authService.login(body));
  }

  // Consumes an invite link (R50) — no JwtAuthGuard, same reasoning as
  // login: there's no session yet at this point.
  @Post("set-password")
  @HttpCode(200)
  @RateLimit({ name: "password-token", max: 20, windowSeconds: 60 * 60 })
  @ApiBody({ type: SetPasswordRequestDto })
  @ApiOkResponse({ type: CmsSessionDto, description: "Sets the httpOnly session cookie" })
  async setPassword(@Body() body: SetPasswordRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<CmsSession> {
    return this.start(reply, await this.authService.setPassword(body));
  }

  // R310: 204 whatever happened, so it can't be used to find accounts
  @Post("forgot-password")
  @HttpCode(204)
  @RateLimit({ name: "forgot-password", max: 5, windowSeconds: 60 * 60 })
  @ApiBody({ type: ForgotPasswordRequestDto })
  @ApiNoContentResponse()
  async forgotPassword(@Body() body: ForgotPasswordRequest): Promise<void> {
    await this.authService.forgotPassword(body);
  }

  @Post("reset-password")
  @HttpCode(200)
  @RateLimit({ name: "password-token", max: 20, windowSeconds: 60 * 60 })
  @ApiBody({ type: ResetPasswordRequestDto })
  @ApiOkResponse({ type: CmsSessionDto, description: "Sets the httpOnly session cookie" })
  async resetPassword(
    @Body() body: ResetPasswordRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<CmsSession> {
    return this.start(reply, await this.authService.resetPassword(body));
  }

  // R320: who's signed in — the CMS can't read its own cookie, so it asks
  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ type: CmsSessionDto })
  me(@CurrentUser() user: JwtClaims): CmsSession {
    return toSession(user);
  }

  // R320: drops the cookie and, if it still holds a live session, revokes it.
  // No JwtAuthGuard: a session that's already dead (reset elsewhere,
  // deactivated) must still be able to clear its cookie. The CSRF guard
  // still applies, so another site can't sign someone out.
  @Post("logout")
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiOkResponse({ type: Boolean })
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<boolean> {
    clearSessionCookie(reply, this.cookie);
    await this.authService.logoutToken(request.cookies?.[SESSION_COOKIE]);
    return true;
  }

  private start(reply: FastifyReply, issued: IssuedSession): CmsSession {
    setSessionCookie(reply, issued.token, new Date(issued.session.expiresAt), this.cookie);
    return issued.session;
  }
}
