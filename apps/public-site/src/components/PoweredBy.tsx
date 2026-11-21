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
    <div className="mx-auto w-full max-w-3xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <p className="border-t border-base-300 pt-4">
        {before}
        <a className="hover:text-base-content hover:underline" href={site.href}>
          {site.label}
        </a>
        {after}
      </p>
    </div>
  );
}
