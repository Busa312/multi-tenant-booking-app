"use client";

import { useEffect, useState } from "react";
import type { Appointment, AvailabilitySlot } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import { fetchRescheduleAvailability } from "@/lib/actions";
import { addDays, dateStringInTimezone, formatDay, todayInTimezone } from "@/lib/tenant-time";
import { SlotGrid } from "./SlotGrid";
import styles from "./RescheduleDialog.module.css";

interface RescheduleDialogProps {
  appointment: Appointment;
  /** The live token — rotated by an earlier reschedule, so not the URL's. */
  token: string;
  timezone: string;
  locale: string;
  onConfirm: (date: string, time: string) => Promise<boolean>;
  onClose: () => void;
  t: Translate;
}

export function RescheduleDialog({ appointment, token, timezone, locale, onConfirm, onClose, t }: RescheduleDialogProps) {
  const [date, setDate] = useState(() => dateStringInTimezone(new Date(appointment.startAt), timezone));
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [startAt, setStartAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Bumped to re-run the availability effect after a failed save, when the day
  // has not changed but its slots have.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSlots(null);

    // R80: token-scoped, so this appointment does not block its own slots —
    // without that, moving a 10:00 booking to 10:15 is impossible.
    void fetchRescheduleAvailability(token, date).then((result) => {
      if (cancelled) return;
      setSlots(result.ok ? result.slots : []);
    });

    return () => {
      cancelled = true;
    };
  }, [token, date, reloadKey]);

  const save = async () => {
    if (!startAt) return;
    setIsSaving(true);
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(startAt));
    const moved = await onConfirm(date, time);
    if (!moved) {
      // The slot went while the dialog was open. `setDate(d => d)` would be a
      // React no-op and leave the grid stuck on "Loading…", so the reload is
      // triggered explicitly.
      setStartAt(null);
      setReloadKey((key) => key + 1);
    }
    setIsSaving(false);
  };

  const today = todayInTimezone(timezone);

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={t("manage.rescheduleHeading")}>
      <div className={styles.dialog}>
        <h2 className={styles.heading}>{t("manage.rescheduleHeading")}</h2>
        {/* R110: the link they followed to get here dies the moment this saves */}
        <p className={styles.note}>{t("manage.rescheduleNote")}</p>

        <div className={styles.days}>
          <button
            type="button"
            className={styles.dayNav}
            onClick={() => setDate(addDays(date, -1))}
            disabled={date <= today}
            aria-label={t("booking.time.previousDay")}
          >
            ‹
          </button>
          <p className={styles.day}>{formatDay(date, timezone, locale)}</p>
          <button
            type="button"
            className={styles.dayNav}
            onClick={() => setDate(addDays(date, 1))}
            aria-label={t("booking.time.nextDay")}
          >
            ›
          </button>
        </div>

        {slots === null ? (
          <p className={styles.status}>{t("booking.time.loading")}</p>
        ) : slots.length === 0 ? (
          <p className={styles.status}>{t("booking.time.noSlots")}</p>
        ) : (
          <SlotGrid
            slots={slots}
            selectedStartAt={startAt}
            timezone={timezone}
            locale={locale}
            onPick={(picked) => setStartAt(picked)}
          />
        )}

        <div className={styles.footer}>
          <button type="button" className={styles.secondary} onClick={onClose} disabled={isSaving}>
            {t("common.back")}
          </button>
          <button type="button" className={styles.primary} onClick={save} disabled={!startAt || isSaving}>
            {t("manage.reschedule")}
          </button>
        </div>
      </div>
    </div>
  );
}
