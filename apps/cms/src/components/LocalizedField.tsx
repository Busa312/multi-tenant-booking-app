import { useState } from "react";
import type { LocalizedText } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { Field, TextInput, Textarea } from "./ui/index.js";
import { cx } from "../lib/cx.js";
import styles from "./LocalizedField.module.css";

interface LocalizedFieldProps {
  label: string;
  id: string;

  locales: string[];

  value: string;
  onChange: (value: string) => void;

  i18n: LocalizedText;
  onI18nChange: (i18n: LocalizedText) => void;
  multiline?: boolean;
  placeholder?: string;
  required?: boolean;
}

// R160: one field
export function LocalizedField({
  label,
  id,
  locales,
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
  const [activeLocale, setActiveLocale] = useState(defaultLocale);
  const isDefault = activeLocale === defaultLocale;

  const current = isDefault ? value : (i18n[activeLocale] ?? "");

  const handleChange = (next: string) => {
    if (isDefault) {
      onChange(next);
      return;
    }

    const updated = { ...i18n };
    if (next === "") {
      delete updated[activeLocale];
    } else {
      updated[activeLocale] = next;
    }
    onI18nChange(updated);
  };

  const control = multiline ? (
    <Textarea
      id={id}
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={isDefault ? placeholder : ""}
      rows={3}
    />
  ) : (
    <TextInput
      id={id}
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={isDefault ? placeholder : ""}
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
            {locale !== defaultLocale && i18n[locale] && <span className={styles.filled} aria-hidden="true" />}
          </button>
        ))}
      </div>
      {control}
      {!isDefault && !current && <p className={styles.hint}>{t("common.translationFallback", { locale: defaultLocale })}</p>}
    </Field>
  );
}
