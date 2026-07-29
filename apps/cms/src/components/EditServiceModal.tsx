import { useState, type FormEvent } from "react";
import type { ProfessionalSummary, ServiceSummary } from "@booking/shared-types";
import { cmsApiClient } from "../lib/api.js";
import { useI18n } from "../i18n/I18nContext.js";
import { Modal } from "./Modal.js";
import { LocalizedField } from "./LocalizedField.js";
import { Alert, Button, Checkbox, Eyebrow, Field, TextInput } from "./ui/index.js";
import styles from "./EditServiceModal.module.css";

interface EditServiceModalProps {
  /** An existing service to edit, or "new" for the create form. */
  target: ServiceSummary | "new";
  professionals: ProfessionalSummary[];
  /** Tenant content locales, first entry = default. */
  locales: string[];
  onClose: () => void;
  onSaved: (saved: ServiceSummary) => void;
}

function validate(name: string, durationMinutes: string, price: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = "services.errNameRequired";

  const duration = Number(durationMinutes);
  if (!durationMinutes.trim() || !Number.isInteger(duration) || duration <= 0) {
    errors.durationMinutes = "services.errDurationPositive";
  }

  const parsedPrice = Number(price);
  if (!price.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    errors.price = "services.errPricePositive";
  }
  return errors;
}

export function EditServiceModal({ target, professionals, locales, onClose, onSaved }: EditServiceModalProps) {
  const { t } = useI18n();
  const isNew = target === "new";
  const [name, setName] = useState(isNew ? "" : target.name);
  const [description, setDescription] = useState(isNew ? "" : (target.description ?? ""));
  const [durationMinutes, setDurationMinutes] = useState(isNew ? "" : String(target.durationMinutes));
  const [price, setPrice] = useState(isNew ? "" : target.price);
  const [professionalIds, setProfessionalIds] = useState<string[]>(isNew ? [] : target.professionalIds);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only active professionals can be newly assigned; a deactivated one that is
  // already on the service stays listed so saving doesn't silently drop it.
  const assignable = professionals.filter((p) => p.isActive || professionalIds.includes(p.id));

  function toggleProfessional(id: string) {
    setProfessionalIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const errors = validate(name, durationMinutes, price);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        durationMinutes: Number(durationMinutes),
        price: price.trim(),
        professionalIds,
      };

      const saved = isNew
        ? await cmsApiClient.createService(payload)
        : await cmsApiClient.updateService(target.id, payload);
      onSaved(saved);
    } catch {
      setError(t("services.errSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isNew ? t("services.editTitleNew") : t("services.editTitleEdit")}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="service-form" disabled={saving}>
            {saving ? t("common.saving") : isNew ? t("common.create") : t("common.save")}
          </Button>
        </>
      }
    >
      <form id="service-form" onSubmit={handleSubmit} noValidate>
        <LocalizedField
          id="service-name"
          label={t("services.nameLabel")}
          locales={locales}
          value={name}
          onChange={setName}
          placeholder={t("services.namePlaceholder")}
          required
        />
        {fieldErrors.name && <Alert className={styles.fieldError}>{t(fieldErrors.name)}</Alert>}

        <LocalizedField
          id="service-description"
          label={t("services.descriptionLabel")}
          locales={locales}
          value={description}
          onChange={setDescription}
          placeholder={t("services.descriptionPlaceholder")}
          multiline
        />

        <div className={styles.numberRow}>
          <Field label={t("services.durationLabel")} htmlFor="service-duration">
            <TextInput
              id="service-duration"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="45"
            />
          </Field>
          <Field label={t("services.priceLabel")} htmlFor="service-price">
            <TextInput
              id="service-price"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="45.00"
            />
          </Field>
        </div>
        {fieldErrors.durationMinutes && <Alert className={styles.fieldError}>{t(fieldErrors.durationMinutes)}</Alert>}
        {fieldErrors.price && <Alert className={styles.fieldError}>{t(fieldErrors.price)}</Alert>}

        <Eyebrow>{t("services.performedBy")}</Eyebrow>
        {assignable.length === 0 && <p className={styles.hint}>{t("services.noProfessionalsCreated")}</p>}
        <div className={styles.professionalList}>
          {assignable.map((p) => (
            <Checkbox key={p.id} checked={professionalIds.includes(p.id)} onChange={() => toggleProfessional(p.id)}>
              {p.name}
              {!p.isActive && ` (${t("services.inactive")})`}
            </Checkbox>
          ))}
        </div>
        {assignable.length > 0 && professionalIds.length === 0 && (
          <p className={styles.hint}>{t("services.noneAssignedHint")}</p>
        )}

        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
