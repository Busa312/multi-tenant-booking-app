import { createHash } from "crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { LoginRequest, LoginResponse, JwtClaims, SetPasswordRequest } from "@booking/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { TenantResolverService } from "../tenant/tenant-resolver.service.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  /**
   * The CMS is a single shared domain (no per-tenant Host to resolve tenant_id
   * from, unlike public-site), so the caller submits `subdomain` alongside
   * their credentials to identify which tenant they belong to. Every request
   * *after* login switches to JWT-derived identity instead (see JwtAuthGuard).
   */
  async login({ subdomain, email, password }: LoginRequest): Promise<LoginResponse> {
    let tenantId: string;
    try {
      tenantId = await this.tenantResolver.resolveTenantIdBySubdomain(subdomain);
    } catch {
      throw new UnauthorizedException("Invalid business, email, or password");
    }
    this.tenantContext.update({ tenantId });

    const user = await this.prisma.forTenant((tx) =>
      tx.tenantUser.findFirst({ where: { tenantId, email, isActive: true } }),
    );

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid business, email, or password");
    }

    await this.prisma.forTenant((tx) =>
      tx.tenantUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    );

    const claims: Omit<JwtClaims, "iat" | "exp"> = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      ...(user.professionalId ? { professionalId: user.professionalId } : {}),
    };

    return { accessToken: await this.jwt.signAsync(claims) };
  }

  /**
   * Consumes an invite token (R50). tenantId travels with the token in the
   * request because `tenant_user` is RLS-protected and fails closed with no
   * tenant context — same reason login takes a subdomain instead of just
   * email+password. tenantId isn't the secret here; the token match is.
   * Issues a JWT on success so the professional lands in the CMS already
   * signed in, same claims shape as login().
   */
  async setPassword({ tenantId, token, password }: SetPasswordRequest): Promise<LoginResponse> {
    this.tenantContext.update({ tenantId });
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const user = await this.prisma.forTenant((tx) =>
      tx.tenantUser.findFirst({
        where: { tenantId, inviteTokenHash: tokenHash, inviteTokenExpiresAt: { gt: new Date() } },
      }),
    );

    if (!user) {
      throw new UnauthorizedException("Invalid or expired invite link");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await this.prisma.forTenant((tx) =>
      tx.tenantUser.update({
        where: { id: user.id },
        data: { passwordHash, inviteTokenHash: null, inviteTokenExpiresAt: null, lastLoginAt: new Date() },
      }),
    );

    const claims: Omit<JwtClaims, "iat" | "exp"> = {
      sub: updated.id,
      tenantId: updated.tenantId,
      role: updated.role,
      ...(updated.professionalId ? { professionalId: updated.professionalId } : {}),
    };

    return { accessToken: await this.jwt.signAsync(claims) };
  }

  async logout(): Promise<boolean> {
    // Invalidate the JWT token on the client side (e.g., by removing it from local storage or cookies).
    // Since JWTs are stateless, we cannot invalidate them server-side without additional mechanisms.
    return true;
  }
}
