"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS, isLocale, type Locale } from "@/i18n/locales";
import styles from "./LanguageSwitcher.module.css";

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
    <div className={styles.group} role="group" aria-label={label} data-pending={isPending || undefined}>
      {LOCALES.filter((locale) => available.includes(locale)).map((locale) => (
        <button
          key={locale}
          type="button"
          className={styles.option}
          aria-pressed={locale === current}
          onClick={() => select(locale)}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
