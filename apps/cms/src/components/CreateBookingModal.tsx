import { useState, type FormEvent } from "react";
import type { BookingConflict, NoShowHistory, LocationSummary, ProfessionalSummary, ServiceSummary } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { conflictsFromError, noShowHistoryFromError } from "../lib/bookingConflicts.js";
import { Modal } from "./Modal.js";
import { SlotPicker } from "./SlotPicker.js";
import { BookingServiceRows } from "./BookingServiceRows.js";
import { BookingConflictNotice } from "./BookingConflictNotice.js";
import { Alert, Button, FormHeading, Field, Icon, Select, TextInput, Textarea } from "./ui/index.js";

interface CreateBookingModalProps {
  services: ServiceSummary[];
  professionals: ProfessionalSummary[];
  // R150: active branches
  locations: LocationSummary[];
  /** R150: the branch the page is filtered to, so a new booking starts there. */
  defaultLocationId?: string | null;
  timezone: string;

  lockedProfessionalId: string | null;

  defaultDate: string;
  onClose: () => void;
  onCreated: (date: string) => void;
}

// R30: a booking taken over the phone or at the desk
export function CreateBookingModal({
  services,
  professionals,
  locations,
  defaultLocationId,
  timezone,
  lockedProfessionalId,
  defaultDate,
  onClose,
  onCreated,
}: CreateBookingModalProps) {
  const { t } = useI18n();
  const nameOf = useLocalizedName();
  const [professionalId, setProfessionalId] = useState(lockedProfessionalId ?? "");
  // R150: preselected when there is only one branch

  const [locationId, setLocationId] = useState(
    defaultLocationId ?? (locations.length === 1 ? (locations[0]?.id ?? "") : ""),
  );

  const [serviceIds, setServiceIds] = useState<string[]>([""]);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [userName, setUserName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [conflicts, setConflicts] = useState<BookingConflict[] | null>(null);
  // R360: read from the same 409 as the conflicts, and shown with them
  const [conflictHistory, setConflictHistory] = useState<NoShowHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const chosenServiceIds = serviceIds.filter(Boolean);
  // R140: only professionals who perform *every* chosen service

  const selectableProfessionals = professionals.filter(
    (p) =>
      p.isActive &&
      chosenServiceIds.every((id) => p.serviceIds.includes(id)) &&
      // R180: at the chosen branch

      (!locationId || p.locationId === null || p.locationId === locationId),
  );
  const lockedProfessional = professionals.find((p) => p.id === lockedProfessionalId);

  const noProfessionalForAll =
    chosenServiceIds.length > 0 && !lockedProfessionalId && selectableProfessionals.length === 0;

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setConflicts(null);
      setError(null);
      setter(value);
    };
  }

  function handleServicesChange(next: string[]) {
    setConflicts(null);
    setError(null);
    setServiceIds(next);

    if (professionalId && !lockedProfessionalId) {
      const performed = professionals.find((p) => p.id === professionalId)?.serviceIds ?? [];
      if (!next.filter(Boolean).every((id) => performed.includes(id))) setProfessionalId("");
    }
  }

  function handleProfessionalChange(next: string) {
    setConflicts(null);

    const performed = professionals.find((p) => p.id === next)?.serviceIds ?? [];
    const kept = serviceIds.filter((id) => !id || performed.includes(id));
    setProfessionalId(next);
    setServiceIds(kept.length > 0 ? kept : [""]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (chosenServiceIds.length === 0) {
      setError(t("bookings.errNoServices"));
      return;
    }
    if (!professionalId || !date || !time || !userName.trim() || !phoneNumber.trim()) {
      setError(t("bookings.errRequired"));
      return;
    }

    if (locations.length > 0 && !locationId) {
      setError(t("bookings.errLocationRequired"));
      return;
    }

    setSaving(true);
    try {
      await cachedApi.createAppointment({
        serviceIds: chosenServiceIds,
        professionalId,
        locationId: locationId || undefined,
        date,
        time,
        userName: userName.trim(),
        phoneNumber: phoneNumber.trim(),
        notes: notes.trim() || undefined,
        // R60: only ever true on the second attempt

        override: conflicts !== null,
      });
      onCreated(date);
    } catch (err) {
      const found = conflictsFromError(err);
      if (found) {
        setConflicts(found);
        setConflictHistory(noShowHistoryFromError(err));
      } else {
        setError(t("bookings.errCreate"));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t("bookings.createTitle")}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="booking-form" danger={conflicts !== null} disabled={saving}>
            {saving ? t("common.saving") : conflicts !== null ? t("bookings.bookAnyway") : t("bookings.book")}
          </Button>
        </>
      }
    >
      <form id="booking-form" onSubmit={handleSubmit} noValidate>
        <BookingServiceRows
          services={services}
          value={serviceIds}
          professionalId={professionalId}
          onChange={handleServicesChange}
        />

        {/* Where and who, side by side when both are asked. */}
        <div className={locations.length > 1 ? "grid gap-x-3 sm:grid-cols-2" : undefined}>
          {locations.length > 1 && (
            <Field label={t("bookings.locationLabel")} htmlFor="booking-location">
              <Select
                id="booking-location"
                value={locationId}
                onChange={(next) => {
                  setConflicts(null);
                  setError(null);
                  setLocationId(next);
                  if (!lockedProfessionalId) setProfessionalId("");
                  setTime("");
                }}
                placeholder={t("bookings.locationPlaceholder")}
                options={locations.map((location) => ({ value: location.id, label: nameOf(location.name, location.nameI18n) }))}
              />
            </Field>
          )}

          <Field label={t("bookings.professionalLabel")} htmlFor="booking-professional">
            {lockedProfessionalId ? (
              // R20: a professional books into their own calendar and no other

              <TextInput id="booking-professional" value={lockedProfessional ? nameOf(lockedProfessional.name, lockedProfessional.nameI18n) : ""} readOnly disabled />
            ) : (
              <Select
                id="booking-professional"
                value={professionalId}
                onChange={handleProfessionalChange}
                placeholder={t("bookings.professionalPlaceholder")}
                options={selectableProfessionals.map((p) => ({ value: p.id, label: nameOf(p.name, p.nameI18n) }))}
              />
            )}
          </Field>
        </div>

        <Field label={t("bookings.dateLabel")} htmlFor="booking-date" className="max-w-52">
          <TextInput
            id="booking-date"
            type="date"
            value={date}
            onChange={(e) => reset(setDate)(e.target.value)}
            required
          />
        </Field>

        {noProfessionalForAll && <Alert variant="warning">{t("bookings.noProfessionalForAll")}</Alert>}

        <SlotPicker
          serviceIds={chosenServiceIds}
          professionalId={professionalId}
          date={date}
          timezone={timezone}
          value={time}
          onChange={reset(setTime)}
        />

        <FormHeading>{t("bookings.customer")}</FormHeading>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Field label={t("bookings.nameLabel")} htmlFor="booking-name">
            <TextInput
              id="booking-name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={t("bookings.namePlaceholder")}
              required
            />
          </Field>
          {/* R270: no email — a phone is all a booking needs */}
          <Field label={t("bookings.phoneLabel")} htmlFor="booking-phone">
            <TextInput
              id="booking-phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+995 555 00 00 00"
              required
            />
          </Field>
        </div>
        <Field label={t("bookings.notesLabel")} htmlFor="booking-notes">
          <Textarea
            id="booking-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("bookings.notesPlaceholder")}
          />
        </Field>

        {/* R70: worth saying out loud */}
        <p className="mb-1 flex items-start gap-1.5 text-xs text-base-content/60">
          <Icon name="info" size={16} />
          {t("bookings.noNotificationHint")}
        </p>

        {conflicts && <BookingConflictNotice conflicts={conflicts} noShowHistory={conflictHistory} timezone={timezone} />}
        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
