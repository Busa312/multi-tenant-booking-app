import { useState, type FormEvent } from "react";
import type {
  AppointmentSummary,
  BookingConflict,
  ProfessionalSummary,
  ServiceSummary,
} from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { conflictsFromError } from "../lib/bookingConflicts.js";
import { tenantDateString, tenantTimeString } from "../lib/tenantTime.js";
import { Modal } from "./Modal.js";
import { SlotPicker } from "./SlotPicker.js";
import { BookingServiceRows } from "./BookingServiceRows.js";
import { BookingConflictNotice } from "./BookingConflictNotice.js";
import { Alert, Button, Field, Select, TextInput } from "./ui/index.js";
import styles from "./EditBookingModal.module.css";

interface EditBookingModalProps {
  appointment: AppointmentSummary;
  services: ServiceSummary[];
  professionals: ProfessionalSummary[];
  timezone: string;

  lockedProfessionalId: string | null;
  onClose: () => void;
  onSaved: (date: string) => void;
}

// R80: change an existing booking's time
export function EditBookingModal({
  appointment,
  services,
  professionals,
  timezone,
  lockedProfessionalId,
  onClose,
  onSaved,
}: EditBookingModalProps) {
  const { t } = useI18n();
  const bookedServiceIds = appointment.services.map((line) => line.serviceId);
  const [date, setDate] = useState(tenantDateString(timezone, new Date(appointment.startAt)));
  const [time, setTime] = useState(tenantTimeString(appointment.startAt, timezone));
  const [professionalId, setProfessionalId] = useState(appointment.professionalId ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>(bookedServiceIds);
  const [conflicts, setConflicts] = useState<BookingConflict[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const chosenServiceIds = serviceIds.filter(Boolean);
  // R140: only professionals who perform *every* service on the booking

  const selectableProfessionals = professionals.filter(
    (p) =>
      (p.isActive || p.id === appointment.professionalId) &&
      chosenServiceIds.every((id) => p.serviceIds.includes(id)) &&
      // R180: the appointment stays at its branch when it is re-timed

      (appointment.locationId === null ||
        p.id === appointment.professionalId ||
        p.locationId === null ||
        p.locationId === appointment.locationId),
  );
  const lockedProfessional = professionals.find((p) => p.id === lockedProfessionalId);
  const noProfessionalForAll =
    chosenServiceIds.length > 0 && !lockedProfessionalId && selectableProfessionals.length === 0;

  const servicesChanged =
    chosenServiceIds.length !== bookedServiceIds.length ||
    chosenServiceIds.some((id, index) => id !== bookedServiceIds[index]);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (chosenServiceIds.length === 0) {
      setError(t("bookings.errNoServices"));
      return;
    }
    if (!date || !time || !professionalId) {
      setError(t("bookings.errRequired"));
      return;
    }

    setSaving(true);
    try {
      await cachedApi.updateAppointment(appointment.id, {
        date,
        time,
        professionalId,
        ...(servicesChanged ? { serviceIds: chosenServiceIds } : {}),
        override: conflicts !== null,
      });
      onSaved(date);
    } catch (err) {
      const found = conflictsFromError(err);
      if (found) {
        setConflicts(found);
      } else {
        setError(t("bookings.errReschedule"));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t("bookings.rescheduleTitle", { name: appointment.userName })}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="edit-booking-form" danger={conflicts !== null} disabled={saving}>
            {saving ? t("common.saving") : conflicts !== null ? t("bookings.moveAnyway") : t("bookings.move")}
          </Button>
        </>
      }
    >
      <form id="edit-booking-form" onSubmit={handleSubmit} noValidate>
        <BookingServiceRows
          services={services}
          value={serviceIds}
          professionalId={professionalId}
          keepSelectable={bookedServiceIds}
          onChange={handleServicesChange}
        />

        <Field label={t("bookings.professionalLabel")} htmlFor="edit-booking-professional">
          {lockedProfessionalId ? (
            <TextInput id="edit-booking-professional" value={lockedProfessional?.name ?? ""} readOnly disabled />
          ) : (
            <Select
              id="edit-booking-professional"
              value={professionalId}
              onChange={reset(setProfessionalId)}
              placeholder={t("bookings.professionalPlaceholder")}
              options={selectableProfessionals.map((p) => ({ value: p.id, label: p.name }))}
            />
          )}
        </Field>

        <Field label={t("bookings.dateLabel")} htmlFor="edit-booking-date" className={styles.date}>
          <TextInput
            id="edit-booking-date"
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
          // R80: without this the appointment blocks its own slots

          appointmentId={appointment.id}
          onChange={reset(setTime)}
        />

        {/* R110: this is the one visible consequence of changing a booking */}
        {appointment.hasMagicLink && <Alert variant="warning">{t("bookings.magicLinkWarning")}</Alert>}

        {conflicts && <BookingConflictNotice conflicts={conflicts} timezone={timezone} />}
        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
