import { useState, type FormEvent } from "react";
import type { LocalizedText, LocationSummary } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { Modal } from "./Modal.js";
import { LocalizedField } from "./LocalizedField.js";
import { Alert, Button, Field, TextInput } from "./ui/index.js";
import styles from "./EditLocationModal.module.css";

interface EditLocationModalProps {
  target: LocationSummary | "new";

  locales: string[];
  onClose: () => void;
  onSaved: () => void;
}

function validate(name: string, addressLine: string, latitude: string, longitude: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = "locations.errNameRequired";
  if (!addressLine.trim()) errors.addressLine = "locations.errAddressRequired";

  const hasLat = latitude.trim() !== "";
  const hasLng = longitude.trim() !== "";
  if (hasLat !== hasLng) {
    errors.coordinates = "locations.errCoordinatePair";
  } else if (hasLat) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.coordinates = "locations.errLatitudeRange";
    else if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.coordinates = "locations.errLongitudeRange";
  }
  return errors;
}

export function EditLocationModal({ target, locales, onClose, onSaved }: EditLocationModalProps) {
  const { t } = useI18n();
  const isNew = target === "new";

  const [name, setName] = useState(isNew ? "" : target.name);
  const [nameI18n, setNameI18n] = useState<LocalizedText>(isNew ? {} : (target.nameI18n ?? {}));
  const [addressLine, setAddressLine] = useState(isNew ? "" : target.addressLine);
  const [addressLineI18n, setAddressLineI18n] = useState<LocalizedText>(
    isNew ? {} : (target.addressLineI18n ?? {}),
  );
  const [city, setCity] = useState(isNew ? "" : (target.city ?? ""));
  const [phone, setPhone] = useState(isNew ? "" : (target.phone ?? ""));
  const [latitude, setLatitude] = useState(isNew ? "" : (target.latitude ?? ""));
  const [longitude, setLongitude] = useState(isNew ? "" : (target.longitude ?? ""));

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const errors = validate(name, addressLine, latitude, longitude);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        nameI18n,
        addressLine: addressLine.trim(),
        addressLineI18n,
        city: city.trim() || null,
        phone: phone.trim() || null,
        latitude: latitude.trim() || null,
        longitude: longitude.trim() || null,
      };

      if (isNew) {
        await cachedApi.createLocation(payload);
      } else {
        await cachedApi.updateLocation(target.id, payload);
      }
      onSaved();
    } catch {
      setError(t("locations.errSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isNew ? t("locations.editTitleNew") : t("locations.editTitleEdit")}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="location-form" disabled={saving}>
            {saving ? t("common.saving") : isNew ? t("common.create") : t("common.save")}
          </Button>
        </>
      }
    >
      <form id="location-form" onSubmit={handleSubmit} noValidate>
        <LocalizedField
          id="location-name"
          label={t("locations.nameLabel")}
          locales={locales}
          value={name}
          onChange={setName}
          i18n={nameI18n}
          onI18nChange={setNameI18n}
          placeholder={t("locations.namePlaceholder")}
          required
        />
        {fieldErrors.name && <Alert className={styles.fieldError}>{t(fieldErrors.name)}</Alert>}

        <LocalizedField
          id="location-address"
          label={t("locations.addressLabel")}
          locales={locales}
          value={addressLine}
          onChange={setAddressLine}
          i18n={addressLineI18n}
          onI18nChange={setAddressLineI18n}
          placeholder={t("locations.addressPlaceholder")}
          required
        />
        {fieldErrors.addressLine && <Alert className={styles.fieldError}>{t(fieldErrors.addressLine)}</Alert>}

        <div className={styles.row}>
          <Field label={t("locations.cityLabel")} htmlFor="location-city">
            <TextInput id="location-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label={t("locations.phoneLabel")} htmlFor="location-phone">
            <TextInput id="location-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>

        <div className={styles.row}>
          <Field label={t("locations.latitudeLabel")} htmlFor="location-latitude">
            <TextInput
              id="location-latitude"
              inputMode="decimal"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="41.712000"
            />
          </Field>
          <Field label={t("locations.longitudeLabel")} htmlFor="location-longitude">
            <TextInput
              id="location-longitude"
              inputMode="decimal"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="44.789000"
            />
          </Field>
        </div>
        <p className={styles.hint}>{t("locations.coordinatesHint")}</p>
        {fieldErrors.coordinates && <Alert className={styles.fieldError}>{t(fieldErrors.coordinates)}</Alert>}

        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
