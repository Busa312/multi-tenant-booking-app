import { useState, type FormEvent } from "react";
import type { LocalizedText, LocationSummary, ProfessionalSummary, Service } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { Modal } from "./Modal.js";
import { LocalizedField } from "./LocalizedField.js";
import { ContentLocaleSelect } from "./ContentLocaleSelect.js";
import { Alert, Button, Checkbox, GroupLabel, Field, Select } from "./ui/index.js";

export function EditProfessionalModal({
  target,
  services,
  locales,
  locations,
  onClose,
  onSaved,
}: {
  target: ProfessionalSummary | "new";
  services: Service[];
  /** Tenant content locales, first entry = default. */
  locales: string[];

  locations: LocationSummary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  // R160: one language choice for every translatable field in the form
  const [contentLocale, setContentLocale] = useState(locales[0] ?? "");
  const activeLocale = locales.includes(contentLocale) ? contentLocale : (locales[0] ?? "");
  const nameOf = useLocalizedName();
  const isNew = target === "new";
  const [name, setName] = useState(isNew ? "" : target.name);
  const [nameI18n, setNameI18n] = useState<LocalizedText>(isNew ? {} : (target.nameI18n ?? {}));
  // R180: "" means every location
  const [locationId, setLocationId] = useState(isNew ? "" : (target.locationId ?? ""));
  const [serviceIds, setServiceIds] = useState<string[]>(isNew ? [] : target.serviceIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = { name, nameI18n, locationId: locationId || null, serviceIds };
      if (isNew) {
        await cachedApi.createProfessional(payload);
      } else {
        await cachedApi.updateProfessional(target.id, payload);
      }
      onSaved();
    } catch {
      setError(t("professionals.errSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isNew ? t("professionals.editTitleNew") : t("professionals.editTitleEdit")}
      onClose={onClose}
      headerAction={<ContentLocaleSelect locales={locales} value={activeLocale} onChange={setContentLocale} />}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="professional-form" disabled={saving}>
            {saving ? t("common.saving") : isNew ? t("common.create") : t("common.save")}
          </Button>
        </>
      }
    >
      <form id="professional-form" onSubmit={handleSubmit}>
        <LocalizedField
          id="prof-name"
          label={t("professionals.nameLabel")}
          locales={locales}
          locale={activeLocale}
          value={name}
          onChange={setName}
          i18n={nameI18n}
          onI18nChange={setNameI18n}
          placeholder={t("professionals.namePlaceholder")}
          required
        />

        {locations.length > 0 && (
          <Field label={t("professionals.locationLabel")} htmlFor="prof-location">
            <Select
              id="prof-location"
              value={locationId}
              onChange={setLocationId}
              options={[
                // R180: the empty value is a real choice ("everywhere")

                { value: "", label: t("professionals.locationAny") },
                ...locations.map((location) => ({ value: location.id, label: nameOf(location.name, location.nameI18n) })),
              ]}
            />
          </Field>
        )}

        <GroupLabel>{t("professionals.servicesPerformed")}</GroupLabel>
        {services.length === 0 && (
          <p className="mb-3 text-[13px] text-base-content/60">{t("professionals.noServicesCreated")}</p>
        )}
        {services.length > 0 && (
          <div className="mb-1.5 rounded-field border border-base-300 px-3 py-1.5">
            {services.map((s) => (
              <Checkbox key={s.id} checked={serviceIds.includes(s.id)} onChange={() => toggleService(s.id)}>
                {nameOf(s.name, s.nameI18n)}
              </Checkbox>
            ))}
          </div>
        )}

        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
