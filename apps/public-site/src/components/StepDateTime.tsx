"use client";

import { useEffect, useState } from "react";
import type { AvailabilitySlot } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import { fetchAvailability } from "@/lib/actions";
import { addDays, formatDay, todayInTimezone } from "@/lib/tenant-time";
import { SlotGrid } from "./SlotGrid";
import type { BookingDraft } from "./BookingWizard";
import styles from "./StepDateTime.module.css";

interface StepDateTimeProps {
  draft: BookingDraft;
  timezone: string;
  locale: string;
  onPickDate: (date: string) => void;

  onPickSlot: (startAt: string, professionalId: string | null) => void;
  onNext: () => void;
  onBack: () => void;
  t: Translate;
}

export function StepDateTime({
  draft,
  timezone,
  locale,
  onPickDate,
  onPickSlot,
  onNext,
  onBack,
  t,
}: StepDateTimeProps) {
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSlots(null);

    void fetchAvailability({
      serviceIds: draft.serviceIds,
      professionalId: draft.professionalId ?? undefined,
      locationId: draft.locationId ?? undefined,
      date: draft.date,
    }).then((result) => {
      if (cancelled) return;
      setSlots(result.ok ? result.slots : []);
    });

    return () => {
      cancelled = true;
    };
  }, [draft.serviceIds, draft.professionalId, draft.locationId, draft.date]);

  const today = todayInTimezone(timezone);
  const isToday = draft.date <= today;

  return (
    <section className={styles.step}>
      <h2 className={styles.heading}>{t("booking.time.heading")}</h2>

      <div className={styles.days}>
        <button
          type="button"
          className={styles.dayNav}
          onClick={() => onPickDate(addDays(draft.date, -1))}
          disabled={isToday}
          aria-label={t("booking.time.previousDay")}
        >
          ‹
        </button>
        <p className={styles.day}>{formatDay(draft.date, timezone, locale)}</p>
        <button
          type="button"
          className={styles.dayNav}
          onClick={() => onPickDate(addDays(draft.date, 1))}
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
          selectedStartAt={draft.startAt}
          timezone={timezone}
          locale={locale}
          onPick={onPickSlot}
        />
      )}

      <div className={styles.footer}>
        <button type="button" className={styles.back} onClick={onBack}>
          {t("common.back")}
        </button>
        <button type="button" className={styles.next} onClick={onNext} disabled={!draft.startAt}>
          {t("common.next")}
        </button>
      </div>
    </section>
  );
}
