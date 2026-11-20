import type { Locale, Translate } from "@/i18n/locales";
import { platformSite } from "@/lib/platform-site";

interface PoweredByProps {
  locale: Locale;
  t: Translate;
}

/**
 * R590: the footer's credit line, linking to the platform's site in the
 * visitor's language. A plain followed link whose text is the domain — the
 * brand, never a keyword phrase.
 */
export function PoweredBy({ locale, t }: PoweredByProps) {
  const site = platformSite(locale);
  // Each language places the link where its grammar wants it ("Powered by {link}").
  const [before = "", after = ""] = t("footer.poweredBy").split("{link}");
  return (
    <p className="mx-auto w-full max-w-3xl px-4 pb-5 text-xs text-base-content/65">
      {before}
      <a className="link link-hover" href={site.href}>
        {site.label}
      </a>
      {after}
    </p>
  );
}
