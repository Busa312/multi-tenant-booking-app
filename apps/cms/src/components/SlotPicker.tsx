import { useEffect, useState } from "react";
import type { AvailabilitySlot } from "@booking/shared-types";
import { cmsApiClient } from "../lib/api.js";
import { useI18n } from "../i18n/I18nContext.js";
import { cx } from "../lib/cx.js";
import { formatTimeLabel, tenantTimeString } from "../lib/tenantTime.js";
import { Eyebrow, Field, TextInput } from "./ui/index.js";
import styles from "./SlotPicker.module.css";

interface SlotPickerProps {
  /** Empty until picked — slots can't be computed without both of these. */
  serviceId: string;
  professionalId: string;
  /** Tenant-local "YYYY-MM-DD". */
  date: string;
  timezone: string;
  /** Tenant-local "HH:mm", or "" while nothing is picked. */
  value: string;
  onChange: (time: string) => void;
}

/**
 * R50: the professional's genuinely open slots, straight from the availability
 * service the public site uses — the default path for picking a time.
 *
 * R60: the free-text time below them is the override path. It stays visible
 * rather than hidden behind a toggle because a phone booking often *starts* from
 * "can you fit me in at six?" — the warning on submit is what makes taking a
 * closed slot deliberate, not a hidden control.
 */
export function SlotPicker({ serviceId, professionalId, date, timezone, value, onChange }: SlotPickerProps) {
  const { t, lang } = useI18n();
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const incomplete = !serviceId || !professionalId || !date;

  useEffect(() => {
    let current = true;
    setSlots(null);
    setError(null);
    if (incomplete) {
      return undefined;
    }
    cmsApiClient
      .listAppointmentAvailability({ serviceId, professionalId, date })
      .then((result) => {
        // A stale response from an earlier service/date must not overwrite the
        // list for the selection the user is now looking at.
        if (current) setSlots(result);
      })
      .catch(() => {
        if (current) setError(t("bookings.errSlots"));
      });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, professionalId, date, incomplete]);

  return (
    <div className={styles.root}>
      <Eyebrow>{t("bookings.openSlots")}</Eyebrow>
      {incomplete && <p className={styles.hint}>{t("bookings.slotsNeedSelection")}</p>}
      {!incomplete && error && <p className={styles.hint}>{error}</p>}
      {!incomplete && !error && slots === null && <p className={styles.hint}>{t("common.loading")}</p>}
      {!error && slots?.length === 0 && <p className={styles.hint}>{t("bookings.noSlots")}</p>}

      {slots && slots.length > 0 && (
        <div className={styles.slots}>
          {slots.map((slot) => {
            const time = tenantTimeString(slot.startAt, timezone);
            return (
              <button
                key={slot.startAt}
                type="button"
                aria-pressed={time === value}
                className={cx(styles.slot, time === value && styles.slotActive)}
                onClick={() => onChange(time)}
              >
                {formatTimeLabel(slot.startAt, timezone, lang)}
              </button>
            );
          })}
        </div>
      )}

      <Field label={t("bookings.timeLabel")} htmlFor="booking-time" className={styles.manual}>
        <TextInput id="booking-time" type="time" value={value} onChange={(e) => onChange(e.target.value)} required />
      </Field>
    </div>
  );
}
