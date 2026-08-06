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
  /** Non-null for a `professional` login: they can't hand the slot to a colleague (R20). */
  lockedProfessionalId: string | null;
  onClose: () => void;
  onSaved: (date: string) => void;
}

/**
 * R80: change an existing booking's time, professional and/or services — with
 * the same open-slot guidance and the same override-with-warning behaviour as
 * creating one.
 *
 * Adding or removing a service changes what the appointment costs and how long
 * it runs, which is why this isn't only a reschedule any more. Services already
 * on it keep the price they were booked at; only newly added ones are quoted at
 * today's (R40), and the API is what enforces that — the totals shown here are
 * just what the staff member is about to commit to.
 */
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
  // R140: only professionals who perform *every* service on the booking can
  // take it. The one it's already with stays listed even if deactivated —
  // otherwise the form would silently offer to hand a departing stylist's
  // booking to someone else as the only way to move its time.
  const selectableProfessionals = professionals.filter(
    (p) =>
      (p.isActive || p.id === appointment.professionalId) &&
      chosenServiceIds.every((id) => p.serviceIds.includes(id)),
  );
  const lockedProfessional = professionals.find((p) => p.id === lockedProfessionalId);
  const noProfessionalForAll =
    chosenServiceIds.length > 0 && !lockedProfessionalId && selectableProfessionals.length === 0;
  // Only send serviceIds when they actually changed, so an ordinary reschedule
  // doesn't rewrite the appointment's lines for nothing.
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
          // A service already booked stays offered even if deactivated since,
          // matching what the API will accept for an existing appointment.
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
          // R80: without this the appointment blocks its own slots, and the
          // times it already covers would be missing from the list.
          appointmentId={appointment.id}
          onChange={reset(setTime)}
        />

        {/* R110: this is the one visible consequence of changing a booking the
            customer made themselves — their existing link stops working. */}
        {appointment.hasMagicLink && <Alert variant="warning">{t("bookings.magicLinkWarning")}</Alert>}

        {conflicts && <BookingConflictNotice conflicts={conflicts} timezone={timezone} />}
        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
