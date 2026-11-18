import { randomBytes } from "node:crypto";
import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Prisma } from "../../generated/prisma/index.js";
import type { AdminTenantSummary, OnboardTenantRequest, OnboardTenantResponse } from "@booking/shared-types";
import { TRIAL_MS } from "../billing/billing-config.js";
import { DEFAULT_PLAN } from "../billing/plans.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { isValidTimezone } from "../common/timezone.js";
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from "../booking/booking-rules.js";
import { issueInviteToken } from "../auth/invite-token.js";
import { OwnerSetupLinkService } from "./owner-setup-link.service.js";

/**
 * R430: a subdomain is a DNS label the host resolver can match: lowercase
 * letters, digits and inner hyphens, at most 63 characters. Uppercase would
 * be stored as typed but never matched (hosts are lowercased).
 */
const SUBDOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Names the platform keeps for itself, or that would mislead a visitor. */
export const RESERVED_SUBDOMAINS = new Set([
  "www", "api", "cms", "admin", "app", "mail", "email", "smtp", "ftp", "static", "assets", "cdn",
  "docs", "help", "support", "status", "blog", "dev", "staging", "test", "demo", "internal",
]);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** A checked request: the owner gets either a password now or an emailed link (R430). */
export interface ValidOnboarding {
  name: string;
  timezone: string;
  subdomain: string;
  ownerEmail: string;
  owner: { password: string } | { emailSetupLink: true };
}

/** The request, cleaned up and checked; throws 400 naming the first problem. */
export function validateOnboarding(input: OnboardTenantRequest): ValidOnboarding {
  const name = text(input?.name);
  const timezone = text(input?.timezone);
  const subdomain = text(input?.subdomain);
  const ownerEmail = text(input?.ownerEmail).toLowerCase();
  const ownerPassword = typeof input?.ownerPassword === "string" ? input.ownerPassword : "";
  const emailSetupLink = input?.emailSetupLink === true;

  if (!name || name.length > 120) {
    throw new BadRequestException("name is required (at most 120 characters)");
  }
  if (!isValidTimezone(timezone)) {
    throw new BadRequestException(`timezone must be a valid IANA zone, e.g. "Asia/Tbilisi" — received "${timezone}"`);
  }
  if (!SUBDOMAIN.test(subdomain)) {
    throw new BadRequestException(
      "subdomain must be lowercase letters, digits and hyphens (not at the start or end), at most 63 characters",
    );
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    throw new BadRequestException(`subdomain "${subdomain}" is reserved`);
  }
  if (!EMAIL.test(ownerEmail)) {
    throw new BadRequestException("ownerEmail must be an email address");
  }
  // R430: one way or the other, never both — a password nobody was told about
  // next to a link would leave the owner unsure which one counts.
  if (emailSetupLink) {
    if (ownerPassword !== "") throw new BadRequestException("Send either ownerPassword or emailSetupLink, not both");
    return { name, timezone, subdomain, ownerEmail, owner: { emailSetupLink: true } };
  }
  // R310: the same rule the CMS applies when the owner sets a password
  if (ownerPassword.length < MIN_PASSWORD_LENGTH || Buffer.byteLength(ownerPassword) > MAX_PASSWORD_BYTES) {
    throw new BadRequestException(`ownerPassword must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_BYTES} characters`);
  }
  return { name, timezone, subdomain, ownerEmail, owner: { password: ownerPassword } };
}

/**
 * Creating salons — platform-level, before any tenant exists, so it uses the
 * raw client rather than `forTenant` (the `tenant` table carries no RLS; the
 * owner row is written with the new tenant set). Used by the internal
 * endpoint and the admin page (R430).
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly setupLinks: OwnerSetupLinkService,
  ) {}

  async onboardTenant(request: OnboardTenantRequest): Promise<OnboardTenantResponse> {
    const input = validateOnboarding(request);
    // R430: with an emailed link the owner has no password until they choose
    // one — the stored hash is of random bytes nobody knows (as for a staff invite).
    const invite = "emailSetupLink" in input.owner ? issueInviteToken() : null;
    const passwordHash = await bcrypt.hash("password" in input.owner ? input.owner.password : randomBytes(16).toString("hex"), 10);

    let created: Omit<OnboardTenantResponse, "setupLink">;
    try {
      created = await this.prisma.client.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: input.name, timezone: input.timezone, subdomain: input.subdomain },
        });

        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;

        const owner = await tx.tenantUser.create({
          data: {
            tenantId: tenant.id,
            email: input.ownerEmail,
            passwordHash,
            role: "owner",
            ...(invite ? { inviteTokenHash: invite.hash, inviteTokenExpiresAt: invite.expiresAt } : {}),
          },
        });

        // R480: every salon starts on a free trial
        await tx.subscription.create({
          data: { tenantId: tenant.id, planId: DEFAULT_PLAN, trialEndsAt: new Date(Date.now() + TRIAL_MS) },
        });

        return {
          tenantId: tenant.id,
          subdomain: tenant.subdomain,
          ownerUserId: owner.id,
          ownerEmail: owner.email,
        };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Subdomain "${input.subdomain}" is already taken`);
      }
      throw err;
    }

    // Sent after the commit: an email must never announce a salon that was rolled back.
    const setupLink = invite
      ? await this.setupLinks.deliver({
          tenantId: created.tenantId,
          salonName: input.name,
          workspace: created.subdomain,
          email: created.ownerEmail,
          token: invite.token,
          expiresAt: invite.expiresAt,
          firstTime: true,
        })
      : null;
    return { ...created, setupLink };
  }

  /**
   * R430: every salon, newest first, with how far its owner got with the setup
   * (R420). Only `tenant` columns — nothing tenant-scoped is read here.
   */
  async listTenants(): Promise<Omit<AdminTenantSummary, "subscription">[]> {
    const tenants = await this.prisma.client.tenant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        subdomain: true,
        timezone: true,
        createdAt: true,
        onboardingFinishedAt: true,
        onboardingDismissedAt: true,
      },
    });
    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      timezone: tenant.timezone,
      createdAt: tenant.createdAt.toISOString(),
      setup: tenant.onboardingFinishedAt ? "finished" : tenant.onboardingDismissedAt ? "hidden" : "in_progress",
    }));
  }
}
