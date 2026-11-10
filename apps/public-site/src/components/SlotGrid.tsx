"use client";

import type { VisitSlot } from "@booking/shared-types";
import { formatTime } from "@/lib/tenant-time";

interface SlotGridProps {
  /** One per bookable start time — the API already returns at most one plan per start. */
  slots: VisitSlot[];
  selectedStartAt: string | null;
  timezone: string;
  locale: string;
  onPick: (slot: VisitSlot) => void;
}

export function SlotGrid({ slots, selectedStartAt, timezone, locale, onPick }: SlotGridProps) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5" role="radiogroup">
      {slots.map((slot) => (
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
  );
}
