import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { OwnerSetupLink } from "@booking/shared-types";
import { issueInviteToken, setPasswordUrl } from "../auth/invite-token.js";
import { cmsBaseUrl } from "../common/cms-url.js";
import { MailService } from "../notifications/mail.service.js";
import { setupLinkEmail } from "../notifications/mail-templates.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";

/** What the email needs to say about a link already stored on the owner. */
export interface IssuedOwnerLink {
  tenantId: string;
  salonName: string;
  workspace: string;
  email: string;
  token: string;
  expiresAt: Date;
  /** The owner has never signed in: the email is a welcome. */
  firstTime: boolean;
}

/**
 * R430: a salon owner's set-password link, emailed by the platform. It is the
 * staff invite's token (R50) — single use, 7 days — so the CMS's set-password
 * page takes it as it is. Issuing one replaces any earlier link; the owner's
 * current password keeps working until the link is used.
 */
@Injectable()
export class OwnerSetupLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Whether the link can actually be emailed — the admin page says so up front. */
  get canEmail(): boolean {
    return this.mail.configured;
  }

  /** A fresh link for the current tenant's owner, emailed. */
  async sendFresh(): Promise<OwnerSetupLink> {
    const { tenantId } = this.tenantContext.current;
    const issued = issueInviteToken();
    const link = await this.prisma.forTenant(async (tx) => {
      // Exactly one owner per salon (a partial unique index).
      const owner = await tx.tenantUser.findFirst({ where: { tenantId, role: "owner" } });
      if (!owner) throw new NotFoundException("This salon has no owner login");
      if (!owner.isActive) throw new ConflictException("The owner's login is turned off");
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, subdomain: true } });
      await tx.tenantUser.update({
        where: { id: owner.id },
        data: { inviteTokenHash: issued.hash, inviteTokenExpiresAt: issued.expiresAt },
      });
      return {
        tenantId,
        salonName: tenant.name,
        workspace: tenant.subdomain,
        email: owner.email,
        token: issued.token,
        expiresAt: issued.expiresAt,
        firstTime: owner.lastLoginAt === null,
      };
    });
    return this.deliver(link);
  }

  /**
   * Emails a link already stored on the owner. When it can't be emailed (no
   * provider, a refusal), the link comes back for the admin to pass on.
   */
  async deliver(link: IssuedOwnerLink): Promise<OwnerSetupLink> {
    const cmsUrl = cmsBaseUrl(this.config.get<string>("CMS_URL"));
    const url = setPasswordUrl(cmsUrl, link.tenantId, link.token);
    const emailed = await this.mail.send({
      to: link.email,
      kind: "owner_setup_link",
      content: setupLinkEmail({
        salonName: link.salonName,
        workspace: link.workspace,
        email: link.email,
        cmsUrl,
        setPasswordUrl: url,
        firstTime: link.firstTime,
      }),
    });
    return { email: link.email, emailed, url: emailed ? null : url, expiresAt: link.expiresAt.toISOString() };
  }
}
