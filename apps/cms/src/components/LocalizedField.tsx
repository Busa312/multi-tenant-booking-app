import { useState } from "react";
import { useI18n } from "../i18n/I18nContext.js";
import { Field, TextInput, Textarea } from "./ui/index.js";
import { cx } from "../lib/cx.js";
import styles from "./LocalizedField.module.css";

interface LocalizedFieldProps {
  label: string;
  id: string;
  /**
   * The tenant's enabled content locales, first entry being the default one.
   * One entry (or none) renders a plain input — which is every tenant today.
   */
  locales: string[];
  /** The default-locale value; the one the Service row's plain column holds. */
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  required?: boolean;
}

export function LocalizedField({
  label,
  id,
  locales,
  value,
  onChange,
  multiline,
  placeholder,
  required,
}: LocalizedFieldProps) {
  const { t } = useI18n();
  const defaultLocale = locales[0] ?? "";
  const [activeLocale, setActiveLocale] = useState(defaultLocale);
  const isDefault = activeLocale === defaultLocale;

  const control = multiline ? (
    <Textarea
      id={id}
      value={isDefault ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={isDefault ? placeholder : ""}
      readOnly={!isDefault}
      rows={3}
    />
  ) : (
    <TextInput
      id={id}
      value={isDefault ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={isDefault ? placeholder : ""}
      readOnly={!isDefault}
      required={required && isDefault}
    />
  );

  if (locales.length < 2) {
    return (
      <Field label={label} htmlFor={id}>
        {control}
      </Field>
    );
  }

  return (
    <Field label={label} htmlFor={id}>
      <div className={styles.tabs} role="tablist" aria-label={label}>
        {locales.map((locale) => (
          <button
            key={locale}
            type="button"
            role="tab"
            aria-selected={locale === activeLocale}
            className={cx(styles.tab, locale === activeLocale && styles.tabActive)}
            onClick={() => setActiveLocale(locale)}
          >
            {locale}
          </button>
        ))}
      </div>
      {control}
      {!isDefault && <p className={styles.hint}>{t("services.translationPending", { locale: activeLocale })}</p>}
    </Field>
  );
}
