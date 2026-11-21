"use client";

import { usePathname } from "next/navigation";
import { LOCALES, LOCALE_LABELS, isLocale, type Locale } from "@/i18n/locales";
import { localePath } from "@/lib/locale-path";

interface LanguageSwitcherProps {
  current: Locale;
  /** The salon's main language: the one whose pages have no prefix. */
  defaultLocale: string;
  enabledLocales: string[] | undefined;
  label: string;
}

/**
 * R160: each language is a link to this same page at that language's URL —
 * real links, so they work without JavaScript and search engines can follow
 * them. The booking wizard keeps its progress across the switch (it restores
 * from the tab's storage).
 */
export function LanguageSwitcher({ current, defaultLocale, enabledLocales, label }: LanguageSwitcherProps) {
  const pathname = usePathname() ?? "/";

  const available = (enabledLocales ?? []).filter(isLocale);
  if (available.length < 2) {
    return null;
  }

  // The page's own path, with whatever language prefix it has now taken off.
  const first = pathname.split("/")[1] ?? "";
  const path = isLocale(first) ? pathname.slice(first.length + 1) || "/" : pathname;

  return (
    <nav className="flex flex-none items-center gap-0.5" aria-label={label}>
      {LOCALES.filter((locale) => available.includes(locale)).map((locale) => {
        const href = localePath(locale, defaultLocale, path);
        return (
          <a
            key={locale}
            href={href}
            hrefLang={locale}
            lang={locale}
            aria-label={LOCALE_LABELS[locale]}
            className={`btn btn-ghost btn-sm px-3 ${locale === current ? "bg-base-200 font-semibold" : "font-normal text-base-content/65"}`}
            aria-current={locale === current ? "true" : undefined}
            onClick={(event) => {
              // Keep the query (a preselected service or branch) across the switch.
              if (window.location.search) {
                event.preventDefault();
                window.location.assign(href + window.location.search);
              }
            }}
          >
            {/* R570: three names don't fit beside the salon's name on a phone, so phones get the codes. */}
            <span className="uppercase sm:hidden">{locale}</span>
            <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
          </a>
        );
      })}
    </nav>
  );
}
