"use client";

import { useMemo } from "react";
import type { AvailabilitySlot } from "@booking/shared-types";
import { formatTime } from "@/lib/tenant-time";
import styles from "./SlotGrid.module.css";

interface SlotGridProps {
  slots: AvailabilitySlot[];
  selectedStartAt: string | null;
  timezone: string;
  locale: string;
  onPick: (startAt: string, professionalId: string | null) => void;
}

export function SlotGrid({ slots, selectedStartAt, timezone, locale, onPick }: SlotGridProps) {
  const unique = useMemo(() => {
    const byStart = new Map<string, AvailabilitySlot>();
    for (const slot of slots) {
      if (!byStart.has(slot.startAt)) {
        byStart.set(slot.startAt, slot);
      }
    }
    return [...byStart.values()];
  }, [slots]);

  return (
    <ul className={styles.grid} role="radiogroup">
      {unique.map((slot) => (
        <li key={slot.startAt}>
          <button
            type="button"
            role="radio"
            aria-checked={slot.startAt === selectedStartAt}
            className={styles.slot}
            onClick={() => onPick(slot.startAt, slot.professionalId)}
          >
            {formatTime(slot.startAt, timezone, locale)}
          </button>
        </li>
      ))}
    </ul>
  );
}
