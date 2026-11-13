"use client";

import type { VisitSlot } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import { formatTime, wallClock } from "@/lib/tenant-time";

interface SlotGridProps {
  /** One per bookable start time — the API already returns at most one plan per start. */
  slots: VisitSlot[];
  selectedStartAt: string | null;
  timezone: string;
  locale: string;
  onPick: (slot: VisitSlot) => void;
  t: Translate;
}

// Parts of the day on the salon's clock: a part ends where the next begins.
const PARTS = [
  { key: "morning", before: 12 },
  { key: "afternoon", before: 17 },
  { key: "evening", before: 24 },
] as const;

// Below this many times the list is short enough to scan without headings.
const GROUP_FROM = 9;

// Times grouped under morning / afternoon / evening, so a full day of slots
// reads as three short lists rather than one wall of buttons.
export function SlotGrid({ slots, selectedStartAt, timezone, locale, onPick, t }: SlotGridProps) {
  const grouped = PARTS.map((part, index) => {
    const from = PARTS[index - 1]?.before ?? 0;
    return {
      key: part.key,
      slots: slots.filter((slot) => {
        const hour = Number(wallClock(slot.startAt, timezone).slice(0, 2));
        return hour >= from && hour < part.before;
      }),
    };
  }).filter((group) => group.slots.length > 0);
  const labelled = slots.length >= GROUP_FROM && grouped.length > 1;

  return (
    <div className="flex flex-col gap-4" role="radiogroup" aria-label={t("booking.time.heading")}>
      {grouped.map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          {labelled && <h3 className="text-sm font-semibold text-base-content/65">{t(`booking.time.${group.key}`)}</h3>}
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {group.slots.map((slot) => (
              <li key={slot.startAt}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={slot.startAt === selectedStartAt}
                  className="btn w-full border-base-300 bg-base-100 font-medium tabular-nums hover:border-primary aria-checked:border-primary aria-checked:bg-primary aria-checked:text-primary-content"
                  onClick={() => onPick(slot)}
                >
                  {formatTime(slot.startAt, timezone, locale)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
