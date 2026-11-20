import type { Locale } from "@/i18n/locales";

// R590: the platform's own marketing site (R560), which every booking site
// credits in its footer. MARKETING_URL is the same setting the API uses for it;
// unset, the link goes to production's root domain.
const PRODUCTION_ORIGIN = "https://book-it.ge";

// The marketing site keeps Georgian at "/" and the others under their code (R560, R570).
const MARKETING_HOME: Record<Locale, string> = { ka: "/", en: "/en/", ru: "/ru/" };

/** The marketing site's home in `locale`, and its bare domain as the link's text ("book-it.ge"). */
export function platformSite(locale: Locale, configured: string | undefined = process.env.MARKETING_URL) {
  const origin = parseOrigin(configured) ?? new URL(PRODUCTION_ORIGIN);
  return {
    href: new URL(MARKETING_HOME[locale], origin).href,
    label: origin.hostname.replace(/^www\./, ""),
  };
}

function parseOrigin(value: string | undefined): URL | null {
  if (!value?.trim()) {
    return null;
  }
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}
