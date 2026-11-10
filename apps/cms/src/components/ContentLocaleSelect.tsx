import { LOCALES, useI18n } from "../i18n/I18nContext.js";
import { Select } from "./ui/index.js";

interface ContentLocaleSelectProps {
  /** The tenant's enabled content locales; the first is the default. */
  locales: string[];
  value: string;
  onChange: (locale: string) => void;
  className?: string;
}

/**
 * R160: which language a form's translatable fields are showing. One per form
 * (a modal's header, the top of a settings card) rather than tabs on every
 * field, so switching to Georgian switches the whole form. Nothing to choose
 * when the tenant publishes in one language, so it renders nothing then.
 */
export function ContentLocaleSelect({ locales, value, onChange, className }: ContentLocaleSelectProps) {
  const { t } = useI18n();
  if (locales.length < 2) return null;

  // Endonyms, as in the CMS's own language picker; an unknown code shows as itself.
  const name = (code: string) => LOCALES.find((locale) => locale.code === code)?.label ?? code.toUpperCase();

  return (
    <Select
      size="sm"
      className={className}
      ariaLabel={t("common.contentLanguage")}
      value={value}
      onChange={onChange}
      options={locales.map((code) => ({ value: code, label: name(code) }))}
    />
  );
}
