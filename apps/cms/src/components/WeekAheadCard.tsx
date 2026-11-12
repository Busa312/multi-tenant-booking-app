import type { DashboardDay } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { formatPercent, ratio } from "../lib/dashboardSummary.js";
import { WeekAheadRow } from "./WeekAheadRow.js";
import { Card, Eyebrow } from "./ui/index.js";

interface WeekAheadCardProps {
  /** Today first, then the next six days. */
  days: DashboardDay[];
  /** True for a `professional` login: the numbers are their own diary. */
  isOwnOnly: boolean;
}

/**
 * R370: the week ahead. Occupancy is booked minutes ÷ working minutes (hours
 * minus time off), so a quiet day shows up while there's still time to fill it.
 */
export function WeekAheadCard({ days, isOwnOnly }: WeekAheadCardProps) {
  const { t, lang } = useI18n();
  const bookings = days.reduce((sum, day) => sum + day.bookings, 0);
  const share = ratio(
    days.reduce((sum, day) => sum + day.bookedMinutes, 0),
    days.reduce((sum, day) => sum + day.workingMinutes, 0),
  );

  return (
    <Card>
      <Eyebrow>{t("dashboard.weekTitle")}</Eyebrow>
      <div className="mt-0.5 font-display text-lg font-semibold">
        {share === null
          ? t("dashboard.weekSummaryNoHours", { bookings })
          : t("dashboard.weekSummary", { bookings, percent: formatPercent(share, lang) })}
      </div>
      <p className="mt-1 text-sm text-base-content/60">{t(isOwnOnly ? "dashboard.weekHintOwn" : "dashboard.weekHint")}</p>

      <ul className="mt-3 divide-y divide-base-300">
        {days.map((day, index) => (
          <WeekAheadRow key={day.date} day={day} isToday={index === 0} />
        ))}
      </ul>
    </Card>
  );
}
