"use client";

import { useEffect, useRef, useState } from "react";
import type { VisitSlot } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import { fetchAvailability } from "@/lib/actions";
import { todayInTimezone } from "@/lib/tenant-time";
import { BTN_BACK, BTN_NEXT, FOOTER, STATUS_TEXT, STEP, STEP_HEADING } from "@/lib/wizardClasses";
import { DayPicker } from "./DayPicker";
import { SlotGrid } from "./SlotGrid";
import { VisitPlan } from "./VisitPlan";
import type { BookingDraft } from "./BookingWizard";

interface StepDateTimeProps {
  draft: BookingDraft;
  timezone: string;
  /** R290: the last day the salon takes online bookings for. */
  lastDate: string;
  locale: string;
  onPickDate: (date: string) => void;
  onPickSlot: (slot: VisitSlot) => void;
  /** R250: the hold on the picked time is still being taken; Continue waits. */
  isHolding: boolean;
  /** R250: the time just picked went to someone else. */
  slotTaken: boolean;
  /** Bumped to refetch the times — after a pick turned out to be taken. */
  slotsVersion: number;
  serviceName: (id: string) => string;
  professionalName: (id: string | null) => string | null;
  onNext: () => void;
  onBack: () => void;
  t: Translate;
}

export function StepDateTime({
  draft,
  timezone,
  lastDate,
  locale,
  onPickDate,
  onPickSlot,
  isHolding,
  slotTaken,
  slotsVersion,
  serviceName,
  professionalName,
  onNext,
  onBack,
  t,
}: StepDateTimeProps) {
  const [slots, setSlots] = useState<VisitSlot[] | null>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const pickedAt = draft.slot?.startAt;
  // R250: read at fetch time, not a dependency — every pick takes a new hold,
  // and refetching the grid on each one would make it flicker.
  const holdId = useRef(draft.hold?.id);
  holdId.current = draft.hold?.id;

  // On a phone the plan renders below a long grid of times, behind the sticky
  // Continue bar — bring it into view so the customer sees who they're booked
  // with before continuing. `scroll-mb-*` on the box keeps it clear of the bar.
  useEffect(() => {
    if (!pickedAt) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    planRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [pickedAt]);

  useEffect(() => {
    let cancelled = false;
    setSlots(null);

    void fetchAvailability({
      serviceIds: draft.serviceIds,
      professionalIds: draft.professionalIds,
      locationId: draft.locationId ?? undefined,
      date: draft.date,
      // R250: so the time this customer is holding stays on their own list
      holdId: holdId.current,
    }).then((result) => {
      if (cancelled) return;
      setSlots(result.ok ? result.slots : []);
    });

    return () => {
      cancelled = true;
    };
  }, [draft.serviceIds, draft.professionalIds, draft.locationId, draft.date, slotsVersion]);

  return (
    <section className={STEP}>
      <h2 className={STEP_HEADING}>{t("booking.time.heading")}</h2>

      <DayPicker
        date={draft.date}
        today={todayInTimezone(timezone)}
        lastDate={lastDate}
        timezone={timezone}
        locale={locale}
        onPick={onPickDate}
        t={t}
      />

      {slotTaken && (
        <div className="alert alert-soft alert-warning" role="alert">
          {t("booking.time.taken")}
        </div>
      )}

      {slots === null ? (
        <p className={STATUS_TEXT}>
          <span className="loading loading-spinner loading-sm" aria-hidden="true" />
          {t("booking.time.loading")}
        </p>
      ) : slots.length === 0 ? (
        <p className={STATUS_TEXT}>{t("booking.time.noSlots")}</p>
      ) : (
        <SlotGrid
          slots={slots}
          selectedStartAt={draft.slot?.startAt ?? null}
          timezone={timezone}
          locale={locale}
          onPick={onPickSlot}
          t={t}
        />
      )}

      {/* R200: the plan behind the chosen time — who does what, and when. */}
      {draft.slot && (
        <div
          ref={planRef}
          className="scroll-mb-24 rounded-box bg-base-200 p-4 sm:scroll-mb-4"
          aria-live="polite"
        >
          <p className="mb-3 text-sm font-semibold text-base-content/70">{t("booking.time.plan")}</p>
          <VisitPlan
            rows={draft.slot.segments.map((segment) => ({
              key: `${segment.startAt}-${segment.professionalId}`,
              startAt: segment.startAt,
              endAt: segment.endAt,
              services: segment.serviceIds.map(serviceName).join(", "),
              professional: professionalName(segment.professionalId),
            }))}
            timezone={timezone}
            locale={locale}
            t={t}
          />
        </div>
      )}

      <div className={FOOTER}>
        <button type="button" className={BTN_BACK} onClick={onBack}>
          {t("common.back")}
        </button>
        {/* R250: the hold is quiet — Continue just waits the moment it takes */}
        <button type="button" className={BTN_NEXT} onClick={onNext} disabled={!draft.slot || isHolding}>
          {isHolding && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
          {t("common.next")}
        </button>
      </div>
    </section>
  );
}
