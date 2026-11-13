import type { OpeningHours } from "@booking/shared-types";
import { DATE_NAMES } from "@/i18n/dates";
import type { Locale } from "@/i18n/locales";

interface OpeningHoursListProps {
  /** Open days only; a weekday that is missing is closed. */
  hours: OpeningHours[];
  /** Today's weekday on the salon's calendar, 0 = Sunday. */
  today: number;
  locale: Locale;
  heading: string;
  closedLabel: string;
  todayLabel: string;
}

// Monday first: that's how a week is read here.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

// R390: when the salon is open — the answer to "can I come today?" without
// starting a booking. Rendered only when the salon has hours to show.
export function OpeningHoursList({ hours, today, locale, heading, closedLabel, todayLabel }: OpeningHoursListProps) {
  if (hours.length === 0) {
    return null;
  }
  const names = DATE_NAMES[locale].weekdays;

  return (
    <section aria-labelledby="hours-heading">
      <h2 className="mb-4 text-2xl font-extrabold tracking-tight" id="hours-heading">
        {heading}
      </h2>
      <dl className="divide-y divide-base-300 border-y-2 border-accent">
        {WEEK.map((dayOfWeek) => {
          const day = hours.find((entry) => entry.dayOfWeek === dayOfWeek);
          const isToday = dayOfWeek === today;
          return (
            <div
              key={dayOfWeek}
              className={`flex items-baseline justify-between gap-4 py-2.5 ${isToday ? "font-bold" : ""}`}
              aria-current={isToday ? "date" : undefined}
            >
              <dt>
                {names[dayOfWeek]}
                {isToday && <span className="badge badge-secondary badge-sm ml-2 align-middle">{todayLabel}</span>}
              </dt>
              <dd className={day ? "tabular-nums" : "text-base-content/65"}>
                {day ? `${day.opens}–${day.closes}` : closedLabel}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
