import { useState, type FormEvent } from "react";
import type { LocalizedText, ServiceCategory } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { Modal } from "./Modal.js";
import { LocalizedField } from "./LocalizedField.js";
import { ContentLocaleSelect } from "./ContentLocaleSelect.js";
import { Alert, Button } from "./ui/index.js";

interface EditCategoryModalProps {
  target: ServiceCategory | "new";
  locales: string[];
  onClose: () => void;
  onSaved: (saved: ServiceCategory) => void;
}

/** R510: naming a service category, in every language the site shows (R160). */
export function EditCategoryModal({ target, locales, onClose, onSaved }: EditCategoryModalProps) {
  const { t } = useI18n();
  const isNew = target === "new";
  const [contentLocale, setContentLocale] = useState(locales[0] ?? "");
  const activeLocale = locales.includes(contentLocale) ? contentLocale : (locales[0] ?? "");
  const [name, setName] = useState(isNew ? "" : target.name);
  const [nameI18n, setNameI18n] = useState<LocalizedText>(isNew ? {} : (target.nameI18n ?? {}));
  const [nameMissing, setNameMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setNameMissing(true);
      return;
    }
    setNameMissing(false);
    setSaving(true);
    try {
      const payload = { name: name.trim(), nameI18n };
      onSaved(isNew ? await cachedApi.createServiceCategory(payload) : await cachedApi.updateServiceCategory(target.id, payload));
    } catch {
      setError(t("services.errCategorySave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isNew ? t("services.categoryNew") : t("services.categoryEdit")}
      onClose={onClose}
      headerAction={<ContentLocaleSelect locales={locales} value={activeLocale} onChange={setContentLocale} />}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="category-form" disabled={saving}>
            {saving ? t("common.saving") : isNew ? t("common.create") : t("common.save")}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} noValidate>
        <LocalizedField
          id="category-name"
          label={t("services.categoryNameLabel")}
          locales={locales}
          locale={activeLocale}
          value={name}
          onChange={setName}
          i18n={nameI18n}
          onI18nChange={setNameI18n}
          placeholder={t("services.categoryNamePlaceholder")}
          required
        />
        {nameMissing && <Alert className="-mt-2 mb-4 py-2">{t("services.errNameRequired")}</Alert>}
        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
