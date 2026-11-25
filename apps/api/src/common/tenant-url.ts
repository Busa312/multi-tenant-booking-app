

export const MANAGE_PATH = "manage";

export function manageUrl(host: string, token: string, protocol: "http" | "https" = "https"): string {
  return `${protocol}://${host}/${MANAGE_PATH}/${encodeURIComponent(token)}`;
}

/**
 * R610: the short form of the manage link, for texts that must fit one SMS
 * part. The booking site redirects `/m/<token>` to `/manage/<token>`.
 */
export const SHORT_MANAGE_PATH = "m";

export function shortManageUrl(origin: string, token: string): string {
  return `${origin}/${SHORT_MANAGE_PATH}/${encodeURIComponent(token)}`;
}

export interface SiteAddressSettings {
  /** `PUBLIC_SITE_URL`: decides http and the port when it points at localhost. */
  siteUrl?: string;
  /** `PUBLIC_SITE_BASE_DOMAIN`: where salons' subdomains live. */
  baseDomain?: string;
}

/**
 * A salon's booking-site origin when no request tells us its host (the
 * reminder scheduler): its verified custom domain, else its subdomain. Locally
 * (`PUBLIC_SITE_URL` on localhost) that's `<subdomain>.localhost` on the same
 * port. Null when neither setting allows building one.
 */
export function tenantSiteOrigin(
  tenant: { subdomain: string; customDomain: string | null; domainVerifiedAt: Date | null },
  settings: SiteAddressSettings,
): string | null {
  if (tenant.customDomain && tenant.domainVerifiedAt) return `https://${tenant.customDomain}`;
  let site: URL | null = null;
  try {
    site = settings.siteUrl ? new URL(settings.siteUrl) : null;
  } catch {
    site = null;
  }
  if (site && (site.hostname === "localhost" || site.hostname === "127.0.0.1")) {
    return `${site.protocol}//${tenant.subdomain}.localhost${site.port ? `:${site.port}` : ""}`;
  }
  const base = settings.baseDomain?.trim().replace(/^\.+|\/+$/g, "");
  return base ? `https://${tenant.subdomain}.${base}` : null;
}
