import { cx } from "../lib/cx.js";
import { LOCALES, useI18n, type Lang } from "../i18n/I18nContext.js";
import styles from "./LanguageSwitcher.module.css";

interface LanguageSwitcherProps {
  className?: string;
}

// Compact language dropdown. Self-contained (reads/writes the i18n context), so
// it can be dropped anywhere — the app shell and the auth screens both use it.
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { lang, setLang, t } = useI18n();

  return (
    <select
      className={cx(styles.select, className)}
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      aria-label={t("language.label")}
    >
      {LOCALES.map((locale) => (
        <option key={locale.code} value={locale.code}>
          {locale.label}
        </option>
      ))}
    </select>
  );
}
