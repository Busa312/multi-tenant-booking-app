import { useState, type FormEvent } from "react";
import type { BookingConflict, ProfessionalSummary, ServiceSummary } from "@booking/shared-types";
import { cmsApiClient } from "../lib/api.js";
import { useI18n } from "../i18n/I18nContext.js";
import { conflictsFromError } from "../lib/bookingConflicts.js";
import { Modal } from "./Modal.js";
import { SlotPicker } from "./SlotPicker.js";
import { BookingConflictNotice } from "./BookingConflictNotice.js";
import { Alert, Button, Eyebrow, Field, Select, TextInput, Textarea } from "./ui/index.js";
import styles from "./CreateBookingModal.module.css";

interface CreateBookingModalProps {
  services: ServiceSummary[];
  professionals: ProfessionalSummary[];
  timezone: string;
  /** Non-null for a `professional` login: the selector is pinned to them (R20). */
  lockedProfessionalId: string | null;
  /** The day the calendar is showing — most phone bookings are for it or near it. */
  defaultDate: string;
  onClose: () => void;
  onCreated: (date: string) => void;
}

/**
 * R30: a booking taken over the phone or at the desk. end_at and price aren't
 * collected — the API derives the first from the service duration and snapshots
 * the second (R40), exactly as a public-site booking does. No magic link is
 * issued and no email goes out (R70).
 */
export function CreateBookingModal({
  services,
  professionals,
  timezone,
  lockedProfessionalId,
  defaultDate,
  onClose,
  onCreated,
}: CreateBookingModalProps) {
  const { t } = useI18n();
  const [professionalId, setProfessionalId] = useState(lockedProfessionalId ?? "");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [userName, setUserName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [conflicts, setConflicts] = useState<BookingConflict[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // R120: a deactivated service is simply not offered. R140: only pairings that
  // exist in ServiceProfessional are selectable, from either direction.
  const selectableServices = services.filter(
    (s) => s.isActive && (!professionalId || s.professionalIds.includes(professionalId)),
  );
  const selectableProfessionals = professionals.filter(
    (p) => p.isActive && (!serviceId || p.serviceIds.includes(serviceId)),
  );
  const lockedProfessional = professionals.find((p) => p.id === lockedProfessionalId);

  // The warning the API sent describes one exact slot; any change to what's
  // being booked makes it stale, so confirmation starts over.
  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setConflicts(null);
      setError(null);
      setter(value);
    };
  }

  function handleServiceChange(next: string) {
    setConflicts(null);
    setServiceId(next);
    // Keeping a professional who doesn't perform the new service would submit a
    // pairing the API rejects (R140).
    if (professionalId && !lockedProfessionalId) {
      const stillValid = professionals.find((p) => p.id === professionalId)?.serviceIds.includes(next);
      if (!stillValid) setProfessionalId("");
    }
  }

  function handleProfessionalChange(next: string) {
    setConflicts(null);
    setProfessionalId(next);
    if (serviceId) {
      const stillValid = services.find((s) => s.id === serviceId)?.professionalIds.includes(next);
      if (!stillValid) setServiceId("");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!serviceId || !professionalId || !date || !time || !userName.trim() || !phoneNumber.trim()) {
      setError(t("bookings.errRequired"));
      return;
    }

    setSaving(true);
    try {
      await cmsApiClient.createAppointment({
        serviceId,
        professionalId,
        date,
        time,
        userName: userName.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        // R60: only ever true on the second attempt, once the staff member has
        // read the named conflicts and pressed "book anyway".
        override: conflicts !== null,
      });
      onCreated(date);
    } catch (err) {
      const found = conflictsFromError(err);
      if (found) {
        setConflicts(found);
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
        <Field label={t("bookings.serviceLabel")} htmlFor="booking-service">
          <Select
            id="booking-service"
            value={serviceId}
            onChange={handleServiceChange}
            placeholder={t("bookings.servicePlaceholder")}
            options={selectableServices.map((s) => ({
              value: s.id,
              label: t("bookings.serviceOption", { name: s.name, minutes: s.durationMinutes, price: s.price }),
            }))}
          />
        </Field>

        <Field label={t("bookings.professionalLabel")} htmlFor="booking-professional">
          {lockedProfessionalId ? (
            // R20: a professional books into their own calendar and no other —
            // shown as a read-only value rather than a one-option dropdown.
            <TextInput id="booking-professional" value={lockedProfessional?.name ?? ""} readOnly disabled />
          ) : (
            <Select
              id="booking-professional"
              value={professionalId}
              onChange={handleProfessionalChange}
              placeholder={t("bookings.professionalPlaceholder")}
              options={selectableProfessionals.map((p) => ({ value: p.id, label: p.name }))}
            />
          )}
        </Field>

        <Field label={t("bookings.dateLabel")} htmlFor="booking-date" className={styles.date}>
          <TextInput
            id="booking-date"
            type="date"
            value={date}
            onChange={(e) => reset(setDate)(e.target.value)}
            required
          />
        </Field>

        <SlotPicker
          serviceId={serviceId}
          professionalId={professionalId}
          date={date}
          timezone={timezone}
          value={time}
          onChange={reset(setTime)}
        />

        <Eyebrow>{t("bookings.customer")}</Eyebrow>
        <Field label={t("bookings.nameLabel")} htmlFor="booking-name">
          <TextInput
            id="booking-name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder={t("bookings.namePlaceholder")}
            required
          />
        </Field>
        <div className={styles.contactRow}>
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
          <Field label={t("bookings.emailLabel")} htmlFor="booking-email">
            <TextInput
              id="booking-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
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

        {/* R70: worth saying out loud — nobody is emailing this customer. */}
        <p className={styles.hint}>{t("bookings.noNotificationHint")}</p>

        {conflicts && <BookingConflictNotice conflicts={conflicts} timezone={timezone} />}
        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
