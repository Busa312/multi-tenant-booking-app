import { createHash, randomBytes, randomUUID } from "crypto";
import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type {
  ForgotPasswordRequest,
  JwtClaims,
  LoginRequest,
  CmsSession,
  ResetPasswordRequest,
  SetPasswordRequest,
} from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { TenantResolverService } from "../tenant/tenant-resolver.service.js";
import { MailService } from "../notifications/mail.service.js";
import { passwordResetEmail, toMailLang } from "../notifications/mail-templates.js";
import { cmsBaseUrl } from "../common/cms-url.js";
import { RateLimitService } from "../rate-limit/rate-limit.service.js";
import { tooManyRequests } from "../rate-limit/rate-limit.guard.js";
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from "../booking/booking-rules.js";

const INVALID_LOGIN = "Invalid business, email, or password";

// R330: per account (tenant + email), on top of the per-address limit on the
// route. Failures only — a correct password clears the count.
const LOGIN_FAILURES_MAX = 5;
const LOGIN_FAILURES_WINDOW_SECONDS = 15 * 60;

// R310
const RESET_TOKEN_TTL_MS = 30 * 60_000;
const RESET_REQUESTS_PER_ACCOUNT = 3;
const RESET_REQUESTS_WINDOW_SECONDS = 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Compared against when there's no user, so "no such account" takes as long
// as "wrong password" — the timing mustn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser", 10);

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** R310: the rules every new password meets — the CMS checks the same ones first. */
export function validatePassword(password: unknown): string {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw new BadRequestException(`password must be at most ${MAX_PASSWORD_BYTES} bytes`);
  }
  return password;
}

interface SessionUser {
  id: string;
  tenantId: string;
  role: JwtClaims["role"];
  professionalId: string | null;
  sessionVersion: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantResolver: TenantResolverService,
    private readonly limits: RateLimitService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The CMS is a single shared domain (no per-tenant Host to resolve tenant_id
   * from, unlike public-site), so the caller submits `subdomain` alongside
   * their credentials to identify which tenant they belong to. Every request
   * *after* login switches to JWT-derived identity instead (see JwtAuthGuard).
   */
  async login({ subdomain, email, password }: LoginRequest): Promise<IssuedSession> {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const tenantId = await this.resolveTenant(subdomain);

    // R330: an account under attack stops accepting guesses for a while.
    // The attempt is counted *before* the password is checked — a check-then-
    // count would let a burst of simultaneous guesses all slip past the limit.
    // A correct password clears the count, so it only ever holds failures
    // (plus at most the attempts in flight).
    const failuresKey = `login-fail:${tenantId ?? "none"}:${sha256(normalizedEmail)}`;
    const attempt = await this.limits.hit(failuresKey, LOGIN_FAILURES_MAX, LOGIN_FAILURES_WINDOW_SECONDS);
    if (!attempt.allowed) {
      throw tooManyRequests(attempt.retryAfterSeconds);
    }

    const user = tenantId
      ? await this.prisma.forTenant((tx) =>
          tx.tenantUser.findFirst({ where: { tenantId, email: normalizedEmail, isActive: true } }),
        )
      : null;

    const passwordMatches = await bcrypt.compare(String(password ?? ""), user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordMatches) {
      throw new UnauthorizedException(INVALID_LOGIN);
    }
    await this.limits.reset(failuresKey);

    await this.prisma.forTenant((tx) =>
      tx.tenantUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    );
    return this.issue(user);
  }

  /**
   * Consumes an invite token (R50). tenantId travels with the token in the
   * request because `tenant_user` is RLS-protected and fails closed with no
   * tenant context — same reason login takes a subdomain instead of just
   * email+password. tenantId isn't the secret here; the token match is.
   * Issues a JWT on success so the professional lands in the CMS already
   * signed in, same claims shape as login().
   */
  async setPassword({ tenantId, token, password }: SetPasswordRequest): Promise<IssuedSession> {
    const valid = validatePassword(password);
    if (!UUID.test(String(tenantId))) throw new UnauthorizedException("Invalid or expired invite link");
    this.tenantContext.update({ tenantId });

    const user = await this.prisma.forTenant((tx) =>
      tx.tenantUser.findFirst({
        where: { tenantId, inviteTokenHash: sha256(String(token)), inviteTokenExpiresAt: { gt: new Date() } },
      }),
    );
    if (!user) {
      throw new UnauthorizedException("Invalid or expired invite link");
    }

    const updated = await this.prisma.forTenant(async (tx) =>
      tx.tenantUser.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(valid, 10),
          inviteTokenHash: null,
          inviteTokenExpiresAt: null,
          lastLoginAt: new Date(),
          // R320: a new password ends every older session
          sessionVersion: { increment: 1 },
        },
      }),
    );
    return this.issue(updated);
  }

  /**
   * R310: always resolves the same way — whether the business or the account
   * exists, or a limit was hit — so the answer can't be used to find accounts.
   */
  async forgotPassword({ subdomain, email, locale }: ForgotPasswordRequest): Promise<void> {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const tenantId = await this.resolveTenant(subdomain);
    if (!tenantId || !normalizedEmail) return;

    const perAccount = await this.limits.hit(
      `reset-request:${tenantId}:${sha256(normalizedEmail)}`,
      RESET_REQUESTS_PER_ACCOUNT,
      RESET_REQUESTS_WINDOW_SECONDS,
    );
    if (!perAccount.allowed) return;

    const found = await this.prisma.forTenant(async (tx) => {
      const user = await tx.tenantUser.findFirst({ where: { tenantId, email: normalizedEmail, isActive: true } });
      // The salon's name goes in the email, so the user knows which login it's for.
      const tenant = user ? await tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }) : null;
      return user && tenant ? { user, salonName: tenant.name } : null;
    });
    if (!found) return;
    const { user, salonName } = found;

    const token = randomBytes(32).toString("base64url");
    await this.prisma.forTenant((tx) =>
      tx.tenantUser.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: sha256(token),
          passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      }),
    );

    // Never on the response: the request is unauthenticated, so that would let
    // anyone reset anyone's password. By email only.
    const resetUrl = `${cmsBaseUrl(this.config.get<string>("CMS_URL"))}/reset-password/${tenantId}/${token}`;
    await this.mail.send({
      to: user.email,
      kind: "password_reset",
      content: passwordResetEmail({ lang: toMailLang(locale), salonName, email: user.email, resetUrl }),
    });
  }

  /** R310: single use; ends every session of the user (R320) and signs them in. */
  async resetPassword({ tenantId, token, password }: ResetPasswordRequest): Promise<IssuedSession> {
    const valid = validatePassword(password);
    if (!UUID.test(String(tenantId))) throw new UnauthorizedException("Invalid or expired reset link");
    this.tenantContext.update({ tenantId });

    const user = await this.prisma.forTenant((tx) =>
      tx.tenantUser.findFirst({
        where: {
          tenantId,
          isActive: true,
          passwordResetTokenHash: sha256(String(token)),
          passwordResetExpiresAt: { gt: new Date() },
        },
      }),
    );
    if (!user) {
      throw new UnauthorizedException("Invalid or expired reset link");
    }

    const updated = await this.prisma.forTenant(async (tx) =>
      tx.tenantUser.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(valid, 10),
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          lastLoginAt: new Date(),
          sessionVersion: { increment: 1 },
        },
      }),
    );
    await this.limits.reset(`login-fail:${tenantId}:${sha256(updated.email)}`);
    return this.issue(updated);
  }

  /**
   * R320: ends this session — its id is refused until the token would have
   * expired anyway. If Redis can't take that note, every session of the user
   * ends instead: logging out must never quietly do nothing.
   */
  /**
   * R320: logging out must work even when the session is already dead (a
   * reset elsewhere, a deactivation) — the caller drops the cookie regardless.
   * A token that still verifies is also revoked; one that doesn't has nothing
   * left to revoke.
   */
  async logoutToken(token: string | undefined): Promise<void> {
    if (!token) return;
    let claims: JwtClaims;
    try {
      claims = await this.jwt.verifyAsync<JwtClaims>(token);
    } catch {
      return;
    }
    if (claims.jti) await this.logout(claims);
  }

  async logout(claims: JwtClaims): Promise<boolean> {
    const ttl = claims.exp - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return true;
    try {
      await this.redis.client.set(revokedSessionKey(claims.jti), "1", "EX", ttl);
    } catch (error) {
      this.logger.warn(`logout fell back to ending every session: ${String(error)}`);
      this.tenantContext.update({ tenantId: claims.tenantId });
      await this.prisma.forTenant((tx) =>
        tx.tenantUser.update({ where: { id: claims.sub }, data: { sessionVersion: { increment: 1 } } }),
      );
    }
    return true;
  }

  private async resolveTenant(subdomain: unknown): Promise<string | null> {
    try {
      const tenantId = await this.tenantResolver.resolveTenantIdBySubdomain(String(subdomain ?? "").toLowerCase());
      this.tenantContext.update({ tenantId });
      return tenantId;
    } catch {
      return null;
    }
  }

  /**
   * A signed session. The token goes into the httpOnly cookie (the controller
   * sets it) and nowhere else; the CMS gets only `session`.
   */
  private async issue(user: SessionUser): Promise<IssuedSession> {
    const claims: Omit<JwtClaims, "iat" | "exp" | "jti"> = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      sv: user.sessionVersion,
      // R320: the 90-day limit counts from here; renewals carry it over
      authTime: Math.floor(Date.now() / 1000),
      ...(user.professionalId ? { professionalId: user.professionalId } : {}),
    };
    const token = await this.jwt.signAsync(claims, { jwtid: randomUUID() });
    const { exp } = this.jwt.decode<{ exp: number }>(token);
    return { token, session: toSession({ ...claims, exp }) };
  }
}

export interface IssuedSession {
  token: string;
  session: CmsSession;
}

/** R320: the session as the CMS sees it — derived from the claims, minus the token. */
export function toSession(claims: Pick<JwtClaims, "sub" | "tenantId" | "role" | "professionalId" | "exp">): CmsSession {
  return {
    userId: claims.sub,
    tenantId: claims.tenantId,
    role: claims.role,
    professionalId: claims.professionalId ?? null,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  };
}

export const revokedSessionKey = (jti: string) => `revoked-session:${jti}`;
