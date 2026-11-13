"use client";

import { DATE_NAMES } from "@/i18n/dates";
import { isLocale, type Translate } from "@/i18n/locales";
import { addDays, formatDay } from "@/lib/tenant-time";

interface DayPickerProps {
  /** The chosen day, "YYYY-MM-DD" on the salon's calendar. */
  date: string;
  today: string;
  /** R290: the last day that can be booked online. */
  lastDate: string;
  timezone: string;
  locale: string;
  onPick: (date: string) => void;
  t: Translate;
}

const WEEK = 7;
const NAV = "btn btn-square btn-ghost text-xl";

/** Whole days from one calendar date to another (both parse as UTC midnight). */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

// A week of days at a time, counted from today, so any day in the next week is
// one tap away and the arrows move a week rather than a day. Used wherever a
// time is picked: the booking wizard and the reschedule dialog.
export function DayPicker({ date, today, lastDate, timezone, locale, onPick, t }: DayPickerProps) {
  const names = DATE_NAMES[isLocale(locale) ? locale : "en"];
  const start = addDays(today, Math.floor(Math.max(0, daysBetween(today, date)) / WEEK) * WEEK);
  const days = Array.from({ length: WEEK }, (_, index) => addDays(start, index));

  // Same weekday in the neighbouring week, kept inside what can be booked.
  const shift = (weeks: number) => {
    const target = addDays(date, weeks * WEEK);
    onPick(target < today ? today : target > lastDate ? lastDate : target);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={NAV}
          onClick={() => shift(-1)}
          disabled={start <= today}
          aria-label={t("booking.time.previousWeek")}
        >
          ‹
        </button>
        <p className="flex-1 text-center font-semibold" aria-live="polite">
          {formatDay(date, timezone, locale)}
        </p>
        <button
          type="button"
          className={NAV}
          onClick={() => shift(1)}
          disabled={addDays(start, WEEK) > lastDate}
          aria-label={t("booking.time.nextWeek")}
        >
          ›
        </button>
      </div>

      <ul className="grid grid-cols-7 gap-1 sm:gap-2" role="radiogroup" aria-label={t("booking.time.dayLabel")}>
        {days.map((day) => (
          <li key={day}>
            <button
              type="button"
              role="radio"
              aria-checked={day === date}
              aria-label={formatDay(day, timezone, locale)}
              className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-field border border-base-300 bg-base-100 py-2 transition-colors hover:border-base-content/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-base-300 aria-checked:border-primary aria-checked:bg-primary aria-checked:text-primary-content motion-reduce:transition-none"
              disabled={day > lastDate}
              onClick={() => onPick(day)}
            >
              <span className="text-xs opacity-75">
                {day === today ? t("booking.time.today") : names.weekdaysShort[new Date(Date.parse(day)).getUTCDay()]}
              </span>
              <span className="text-lg leading-none font-bold tabular-nums">{Number(day.slice(8))}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
