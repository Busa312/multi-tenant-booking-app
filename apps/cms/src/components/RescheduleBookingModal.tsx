import { useState, type FormEvent } from "react";
import type { AppointmentSummary, BookingConflict, ProfessionalSummary } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { conflictsFromError } from "../lib/bookingConflicts.js";
import { tenantDateString, tenantTimeString } from "../lib/tenantTime.js";
import { Modal } from "./Modal.js";
import { SlotPicker } from "./SlotPicker.js";
import { BookingConflictNotice } from "./BookingConflictNotice.js";
import { Alert, Button, Field, Select, TextInput } from "./ui/index.js";
import styles from "./RescheduleBookingModal.module.css";

interface RescheduleBookingModalProps {
  appointment: AppointmentSummary;
  professionals: ProfessionalSummary[];
  timezone: string;
  /** Non-null for a `professional` login: they can't hand the slot to a colleague (R20). */
  lockedProfessionalId: string | null;
  onClose: () => void;
  onRescheduled: (date: string) => void;
}

/**
 * R80: move an existing booking in time, to another professional, or both — with
 * the same open-slot guidance and the same override-with-warning behaviour as
 * creating one.
 */
export function RescheduleBookingModal({
  appointment,
  professionals,
  timezone,
  lockedProfessionalId,
  onClose,
  onRescheduled,
}: RescheduleBookingModalProps) {
  const { t } = useI18n();
  const [date, setDate] = useState(tenantDateString(timezone, new Date(appointment.startAt)));
  const [time, setTime] = useState(tenantTimeString(appointment.startAt, timezone));
  const [professionalId, setProfessionalId] = useState(appointment.professionalId ?? "");
  const [conflicts, setConflicts] = useState<BookingConflict[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // R140: only professionals who perform this appointment's service can take it.
  // The one it's already with stays listed even if deactivated — otherwise the
  // form would silently offer to hand a departing stylist's booking to someone
  // else as the only way to move its time.
  const selectableProfessionals = professionals.filter(
    (p) =>
      (p.isActive || p.id === appointment.professionalId) && p.serviceIds.includes(appointment.serviceId),
  );
  const lockedProfessional = professionals.find((p) => p.id === lockedProfessionalId);

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setConflicts(null);
      setError(null);
      setter(value);
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!date || !time || !professionalId) {
      setError(t("bookings.errRequired"));
      return;
    }

    setSaving(true);
    try {
      await cachedApi.rescheduleAppointment(appointment.id, {
        date,
        time,
        professionalId,
        override: conflicts !== null,
      });
      onRescheduled(date);
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
          <Button type="submit" form="reschedule-form" danger={conflicts !== null} disabled={saving}>
            {saving ? t("common.saving") : conflicts !== null ? t("bookings.moveAnyway") : t("bookings.move")}
          </Button>
        </>
      }
    >
      <form id="reschedule-form" onSubmit={handleSubmit} noValidate>
        <p className={styles.summary}>
          {t("bookings.rescheduleSummary", {
            service: appointment.serviceName,
            minutes: appointment.serviceDurationMinutes,
          })}
        </p>

        <Field label={t("bookings.professionalLabel")} htmlFor="reschedule-professional">
          {lockedProfessionalId ? (
            <TextInput id="reschedule-professional" value={lockedProfessional?.name ?? ""} readOnly disabled />
          ) : (
            <Select
              id="reschedule-professional"
              value={professionalId}
              onChange={reset(setProfessionalId)}
              placeholder={t("bookings.professionalPlaceholder")}
              options={selectableProfessionals.map((p) => ({ value: p.id, label: p.name }))}
            />
          )}
        </Field>

        <Field label={t("bookings.dateLabel")} htmlFor="reschedule-date" className={styles.date}>
          <TextInput
            id="reschedule-date"
            type="date"
            value={date}
            onChange={(e) => reset(setDate)(e.target.value)}
            required
          />
        </Field>

        <SlotPicker
          serviceId={appointment.serviceId}
          professionalId={professionalId}
          date={date}
          timezone={timezone}
          value={time}
          onChange={reset(setTime)}
        />

        {/* R110: this is the one visible consequence of moving a booking the
            customer made themselves — their existing link stops working. */}
        {appointment.hasMagicLink && <Alert variant="warning">{t("bookings.magicLinkWarning")}</Alert>}

        {conflicts && <BookingConflictNotice conflicts={conflicts} timezone={timezone} />}
        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
