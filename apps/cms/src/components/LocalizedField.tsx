import type { LocalizedText } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { Field, TextInput, Textarea } from "./ui/index.js";

interface LocalizedFieldProps {
  label: string;
  id: string;

  /** The tenant's content locales; the first is the default, held in `value`. */
  locales: string[];
  /** The language being edited — chosen once for the whole form (ContentLocaleSelect). */
  locale: string;

  value: string;
  onChange: (value: string) => void;

  i18n: LocalizedText;
  onI18nChange: (i18n: LocalizedText) => void;
  multiline?: boolean;
  placeholder?: string;
  required?: boolean;
}

/**
 * R160: one translatable field. The default language edits the plain column;
 * any other edits that language's entry in `i18n`. Which one is shown is the
 * form's choice, not the field's, so every field in a form moves together.
 */
export function LocalizedField({
  label,
  id,
  locales,
  locale,
  value,
  onChange,
  i18n,
  onI18nChange,
  multiline,
  placeholder,
  required,
}: LocalizedFieldProps) {
  const { t } = useI18n();
  const defaultLocale = locales[0] ?? "";
  const isDefault = locale === defaultLocale || !locales.includes(locale);

  const current = isDefault ? value : (i18n[locale] ?? "");
  // Translating: the original stands in as the placeholder, so the translator
  // sees what they're translating without switching back.
  const hint = isDefault ? placeholder : value || placeholder;

  const handleChange = (next: string) => {
    if (isDefault) {
      onChange(next);
      return;
    }
    const updated = { ...i18n };
    if (next === "") {
      delete updated[locale];
    } else {
      updated[locale] = next;
    }
    onI18nChange(updated);
  };

  return (
    <Field label={label} htmlFor={id}>
      {multiline ? (
        <Textarea id={id} value={current} onChange={(e) => handleChange(e.target.value)} placeholder={hint} rows={3} />
      ) : (
        <TextInput
          id={id}
          value={current}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={hint}
          required={required && isDefault}
          lang={isDefault ? defaultLocale : locale}
        />
      )}
      {!isDefault && !current && (
        <p className="mt-1.5 text-xs text-base-content/55">{t("common.translationFallback", { locale: defaultLocale })}</p>
      )}
    </Field>
  );
}
