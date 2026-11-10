"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS, isLocale, type Locale } from "@/i18n/locales";

interface LanguageSwitcherProps {
  current: Locale;

  enabledLocales: string[] | undefined;
  label: string;
}

export function LanguageSwitcher({ current, enabledLocales, label }: LanguageSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const available = (enabledLocales ?? []).filter(isLocale);
  if (available.length < 2) {
    return null;
  }

  const select = (locale: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <div
      className={`join flex-none transition-opacity ${isPending ? "pointer-events-none opacity-60" : ""}`}
      role="group"
      aria-label={label}
    >
      {LOCALES.filter((locale) => available.includes(locale)).map((locale) => (
        <button
          key={locale}
          type="button"
          className={`btn join-item btn-sm ${locale === current ? "btn-primary" : "border-base-300 bg-base-100 font-normal"}`}
          aria-pressed={locale === current}
          onClick={() => select(locale)}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
