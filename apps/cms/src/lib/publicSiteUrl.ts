const PUBLIC_SITE_BASE_DOMAIN = import.meta.env.VITE_PUBLIC_SITE_BASE_DOMAIN as string | undefined;
const PUBLIC_SITE_PROTOCOL = (import.meta.env.VITE_PUBLIC_SITE_PROTOCOL as string | undefined) ?? "http";

/** Where a tenant's booking site lives, or null when this build doesn't know the base domain. */
export function publicSiteUrl(subdomain: string): string | null {
  return PUBLIC_SITE_BASE_DOMAIN ? `${PUBLIC_SITE_PROTOCOL}://${subdomain}.${PUBLIC_SITE_BASE_DOMAIN}` : null;
}
