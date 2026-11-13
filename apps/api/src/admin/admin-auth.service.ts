import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { AdminLoginRequest, AdminSession } from "@booking/shared-types";
import { RedisService } from "../redis/redis.service.js";
import { RateLimitService } from "../rate-limit/rate-limit.service.js";

/** How long an admin stays signed in. */
export const ADMIN_SESSION_SECONDS = 2 * 60 * 60;

/** Sign-in attempts from every address together, per hour — on top of the per-address limit. */
export const ADMIN_LOGIN_GLOBAL_MAX = 30;

const sessionKey = (id: string) => `admin-session:${id}`;
const TOKEN_TYPE = "platform-admin";

/** Compared when the email is wrong, so a wrong email takes as long as a wrong password. */
const DECOY_HASH = bcrypt.hashSync(randomBytes(16).toString("hex"), 10);

const digest = (value: string) => createHash("sha256").update(value.trim().toLowerCase()).digest();

interface AdminClaims {
  typ: string;
  email: string;
  jti?: string;
}

/**
 * R430: the one platform admin, configured in the environment — not a CMS
 * user and tied to no salon. Its tokens are signed with a key derived from
 * JWT_SECRET but different from the CMS's, and carry their own type, so a CMS
 * session can never pass as an admin one or the other way round. Each session
 * is also held in Redis, so signing out ends it.
 */
@Injectable()
export class AdminAuthService {
  private readonly email: string | undefined;
  private readonly passwordHash: string | undefined;
  private readonly jwt: JwtService;

  constructor(
    config: ConfigService,
    private readonly redis: RedisService,
    private readonly limits: RateLimitService,
  ) {
    this.email = config.get<string>("ADMIN_EMAIL")?.trim() || undefined;
    this.passwordHash = config.get<string>("ADMIN_PASSWORD_HASH")?.trim() || undefined;
    const secret = createHmac("sha256", config.getOrThrow<string>("JWT_SECRET")).update(TOKEN_TYPE).digest("hex");
    this.jwt = new JwtService({ secret, signOptions: { expiresIn: ADMIN_SESSION_SECONDS } });
  }

  /** Configured at all. Without both settings the admin page doesn't exist. */
  get enabled(): boolean {
    return this.email !== undefined && this.passwordHash !== undefined;
  }

  assertEnabled(): void {
    if (!this.enabled) throw new NotFoundException();
  }

  async login(body: AdminLoginRequest): Promise<{ token: string; session: AdminSession }> {
    this.assertEnabled();
    const global = await this.limits.hit("admin-login:all", ADMIN_LOGIN_GLOBAL_MAX, 60 * 60);
    if (!global.allowed) {
      throw new HttpException({ code: "rate_limited", retryAfterSeconds: global.retryAfterSeconds }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const email = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const emailMatches = timingSafeEqual(digest(email), digest(this.email ?? ""));
    // Always one bcrypt comparison, so the response time doesn't tell whether the email was right.
    const passwordMatches = await bcrypt.compare(password, emailMatches ? (this.passwordHash ?? DECOY_HASH) : DECOY_HASH);
    if (!emailMatches || !passwordMatches) {
      throw new UnauthorizedException("Wrong email or password");
    }

    const id = randomUUID();
    const token = await this.jwt.signAsync({ typ: TOKEN_TYPE, email: this.email }, { jwtid: id });
    await this.redis.client.set(sessionKey(id), "1", "EX", ADMIN_SESSION_SECONDS);
    const expiresAt = new Date(Date.now() + ADMIN_SESSION_SECONDS * 1000);
    return { token, session: { email: this.email ?? "", expiresAt: expiresAt.toISOString() } };
  }

  /** The session a token stands for, or null — expired, signed out, forged, or a CMS token. */
  async verify(token: string | undefined): Promise<AdminSession | null> {
    if (!this.enabled || !token) return null;
    let claims: AdminClaims & { exp?: number };
    try {
      claims = await this.jwt.verifyAsync<AdminClaims & { exp?: number }>(token);
    } catch {
      return null;
    }
    if (claims.typ !== TOKEN_TYPE || !claims.jti || claims.email !== this.email) return null;
    if ((await this.redis.client.exists(sessionKey(claims.jti))) !== 1) return null;
    return { email: claims.email, expiresAt: new Date((claims.exp ?? 0) * 1000).toISOString() };
  }

  /** Ends the session for good. A token that isn't valid has nothing to end. */
  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    try {
      const claims = await this.jwt.verifyAsync<AdminClaims>(token);
      if (claims.jti) await this.redis.client.del(sessionKey(claims.jti));
    } catch {
      // Expired or forged: already no session.
    }
  }
}
