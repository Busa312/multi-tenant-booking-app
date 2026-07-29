import { LOCALES, useI18n, type Lang } from "../i18n/I18nContext.js";
import { Select } from "./ui/index.js";

interface LanguageSwitcherProps {
  className?: string;
}

// Compact language dropdown. Self-contained (reads/writes the i18n context), so
// it can be dropped anywhere — the app shell and the auth screens both use it.
// Styling comes entirely from Select's `sm` variant; there's nothing left for a
// co-located module to own.
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { lang, setLang, t } = useI18n();

  return (
    <Select
      size="sm"
      className={className}
      ariaLabel={t("language.label")}
      value={lang}
      onChange={(value) => setLang(value as Lang)}
      // Endonyms — each language names itself, so these aren't translated.
      options={LOCALES.map((locale) => ({ value: locale.code, label: locale.label }))}
    />
  );
}
