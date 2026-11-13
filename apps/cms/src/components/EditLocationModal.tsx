import { useState, type FormEvent } from "react";
import type { LocalizedText, LocationSummary } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { Modal } from "./Modal.js";
import { LocalizedField } from "./LocalizedField.js";
import { ContentLocaleSelect } from "./ContentLocaleSelect.js";
import { LocationMapPicker, type LatLng } from "./LocationMapPicker.js";
import { Alert, Button, Field, TextInput } from "./ui/index.js";

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
  // R160: one language choice for every translatable field in the form
  const [contentLocale, setContentLocale] = useState(locales[0] ?? "");
  const activeLocale = locales.includes(contentLocale) ? contentLocale : (locales[0] ?? "");
  const isNew = target === "new";

  const [name, setName] = useState(isNew ? "" : target.name);
  const [nameI18n, setNameI18n] = useState<LocalizedText>(isNew ? {} : (target.nameI18n ?? {}));
  const [addressLine, setAddressLine] = useState(isNew ? "" : target.addressLine);
  const [addressLineI18n, setAddressLineI18n] = useState<LocalizedText>(
    isNew ? {} : (target.addressLineI18n ?? {}),
  );
  const [city, setCity] = useState(isNew ? "" : (target.city ?? ""));
  const [cityI18n, setCityI18n] = useState<LocalizedText>(isNew ? {} : (target.cityI18n ?? {}));
  const [phone, setPhone] = useState(isNew ? "" : (target.phone ?? ""));
  const [latitude, setLatitude] = useState(isNew ? "" : (target.latitude ?? ""));
  const [longitude, setLongitude] = useState(isNew ? "" : (target.longitude ?? ""));

  // Set by the map pin; kept as the strings the API takes (Decimal(9,6)).
  const pinned: LatLng | null =
    latitude && longitude ? { lat: Number(latitude), lng: Number(longitude) } : null;

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
        cityI18n,
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
      headerAction={<ContentLocaleSelect locales={locales} value={activeLocale} onChange={setContentLocale} />}
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
          locale={activeLocale}
          value={name}
          onChange={setName}
          i18n={nameI18n}
          onI18nChange={setNameI18n}
          placeholder={t("locations.namePlaceholder")}
          required
        />
        {fieldErrors.name && <Alert className="-mt-2 mb-4 py-2">{t(fieldErrors.name)}</Alert>}

        <LocalizedField
          id="location-address"
          label={t("locations.addressLabel")}
          locales={locales}
          locale={activeLocale}
          value={addressLine}
          onChange={setAddressLine}
          i18n={addressLineI18n}
          onI18nChange={setAddressLineI18n}
          placeholder={t("locations.addressPlaceholder")}
          required
        />
        {fieldErrors.addressLine && <Alert className="-mt-2 mb-4 py-2">{t(fieldErrors.addressLine)}</Alert>}

        <div className="grid gap-x-3 sm:grid-cols-2">
          {/* R160: the city translates with the address line, so the two read as one address */}
          <LocalizedField
            id="location-city"
            label={t("locations.cityLabel")}
            locales={locales}
            locale={activeLocale}
            value={city}
            onChange={setCity}
            i18n={cityI18n}
            onI18nChange={setCityI18n}
          />

          <Field label={t("locations.phoneLabel")} htmlFor="location-phone">
            <TextInput
              id="location-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+995 555 00 00 00"
            />
          </Field>
        </div>

        <LocationMapPicker
          value={pinned}
          onChange={(next) => {
            setLatitude(next ? next.lat.toFixed(6) : "");
            setLongitude(next ? next.lng.toFixed(6) : "");
          }}
          initialQuery={[addressLine, city].filter((part) => part.trim()).join(", ")}
        />
        {fieldErrors.coordinates && <Alert className="py-2">{t(fieldErrors.coordinates)}</Alert>}

        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
