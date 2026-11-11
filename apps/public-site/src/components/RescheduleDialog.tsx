"use client";

import { useEffect, useRef, useState } from "react";
import type { Visit, VisitSlot } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import { fetchRescheduleAvailability } from "@/lib/actions";
import { addDays, dateStringInTimezone, formatDay, todayInTimezone, wallClock } from "@/lib/tenant-time";
import { SlotGrid } from "./SlotGrid";

interface RescheduleDialogProps {
  /** R230: the whole visit moves; each segment keeps its professional. */
  visit: Visit;
  /** The live token — rotated by an earlier reschedule, so not the URL's. */
  token: string;
  timezone: string;
  /** R290 */
  lastDate: string;
  locale: string;
  onConfirm: (date: string, time: string) => Promise<boolean>;
  onClose: () => void;
  t: Translate;
}

export function RescheduleDialog({ visit, token, timezone, lastDate, locale, onConfirm, onClose, t }: RescheduleDialogProps) {
  const [date, setDate] = useState(() => dateStringInTimezone(new Date(visit.startAt), timezone));
  const [slots, setSlots] = useState<VisitSlot[] | null>(null);
  const [startAt, setStartAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Bumped to re-run the availability effect after a failed save, when the day
  // has not changed but its slots have.
  const [reloadKey, setReloadKey] = useState(0);
  const ref = useRef<HTMLDialogElement>(null);

  // Native <dialog> + showModal(), as in CancelDialog.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSlots(null);

    // R80: token-scoped, so this visit does not block its own slots —
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
    const time = wallClock(startAt, timezone);
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
    <dialog
      ref={ref}
      className="modal modal-bottom sm:modal-middle"
      aria-label={t("manage.rescheduleHeading")}
      onCancel={(event) => {
        event.preventDefault();
        if (!isSaving) onClose();
      }}
    >
      <div className="modal-box flex max-h-[90dvh] flex-col gap-4 sm:max-w-lg">
        <h2 className="text-lg font-bold">{t("manage.rescheduleHeading")}</h2>
        {/* R110: the link they followed to get here dies the moment this saves */}
        <p className="-mt-2 text-sm text-base-content/65">{t("manage.rescheduleNote")}</p>

        <div className="flex items-center gap-2 rounded-box border border-base-300 bg-base-200/60 p-1.5">
          <button
            type="button"
            className={"btn btn-square btn-ghost text-xl"}
            onClick={() => setDate(addDays(date, -1))}
            disabled={date <= today}
            aria-label={t("booking.time.previousDay")}
          >
            ‹
          </button>
          <p className="flex-1 text-center font-semibold" aria-live="polite">{formatDay(date, timezone, locale)}</p>
          <button
            type="button"
            className={"btn btn-square btn-ghost text-xl"}
            onClick={() => setDate(addDays(date, 1))}
            disabled={date >= lastDate}
            aria-label={t("booking.time.nextDay")}
          >
            ›
          </button>
        </div>

        {slots === null ? (
          <p className="flex items-center gap-2 py-6 text-base-content/65">
            <span className="loading loading-spinner loading-sm" aria-hidden="true" />
            {t("booking.time.loading")}
          </p>
        ) : slots.length === 0 ? (
          <p className="py-6 text-base-content/65">{t("booking.time.noSlots")}</p>
        ) : (
          <SlotGrid
            slots={slots}
            selectedStartAt={startAt}
            timezone={timezone}
            locale={locale}
            onPick={(picked) => setStartAt(picked.startAt)}
          />
        )}

        <div className="modal-action mt-0 flex-wrap">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSaving}>
            {t("common.back")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!startAt || isSaving}>
            {t("manage.reschedule")}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" aria-hidden="true" onClick={() => !isSaving && onClose()} />
    </dialog>
  );
}
