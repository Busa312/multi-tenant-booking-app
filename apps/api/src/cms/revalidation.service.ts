import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Tenant } from "@booking/shared-types";

/**
 * Best-effort trigger for apps/public-site's on-demand ISR revalidation (R50).
 * The DB write is the source of truth — a failed/slow revalidation call logs a
 * warning but never fails the CMS request that saved the color change.
 *
 * public-site resolves tenants by Host header (subdomain or custom domain),
 * not by tenant_id in the URL, so the target of revalidation is the tenant's
 * hostname(s), not an id — see RevalidationService's counterpart, the
 * tenant-host-tagged cache in apps/public-site/src/lib/tenant-config.ts.
 */
@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);

  constructor(private readonly config: ConfigService) {}

  async revalidateTenant(tenant: Pick<Tenant, "subdomain" | "customDomain" | "domainVerifiedAt">): Promise<void> {
    const publicSiteUrl = this.config.get<string>("PUBLIC_SITE_URL");
    const baseDomain = this.config.get<string>("PUBLIC_SITE_BASE_DOMAIN");
    const secret = this.config.get<string>("REVALIDATE_SECRET");

    if (!publicSiteUrl || !baseDomain || !secret) {
      this.logger.warn(
        "Skipping revalidation: PUBLIC_SITE_URL/PUBLIC_SITE_BASE_DOMAIN/REVALIDATE_SECRET not configured",
      );
      return;
    }

    const hosts = [`${tenant.subdomain}.${baseDomain}`];
    if (tenant.customDomain && tenant.domainVerifiedAt) {
      hosts.push(tenant.customDomain);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(`${publicSiteUrl}/api/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
        body: JSON.stringify({ hosts }),
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger.warn(`Revalidation request failed with status ${res.status} for hosts ${hosts.join(", ")}`);
      }
    } catch (err) {
      this.logger.warn(`Revalidation request errored for hosts ${hosts.join(", ")}: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
