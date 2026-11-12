import type { DashboardDay } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { formatPercent, occupancy } from "../lib/dashboardSummary.js";
import { dayOfMonth, formatWeekdayLabel } from "../lib/tenantTime.js";

interface WeekAheadRowProps {
  day: DashboardDay;
  isToday: boolean;
}

/** One day of the week ahead: how many bookings, and how much of the working time they fill. */
export function WeekAheadRow({ day, isToday }: WeekAheadRowProps) {
  const { t, lang } = useI18n();
  const share = occupancy(day);
  const dayLabel = isToday ? t("dashboard.weekToday") : `${formatWeekdayLabel(day.date, lang)} ${dayOfMonth(day.date)}`;

  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)_3rem] items-center gap-3 py-2 sm:grid-cols-[5.5rem_minmax(0,1fr)_3.5rem_5.5rem]">
      <div className="truncate text-[13.5px] font-semibold">{dayLabel}</div>

      {share === null ? (
        <div className="text-xs text-base-content/55">{t("dashboard.weekClosed")}</div>
      ) : (
        <progress
          className="progress progress-primary"
          value={Math.min(100, Math.round(share * 100))}
          max={100}
          aria-label={t("dashboard.weekOccupancyLabel", { day: dayLabel, percent: formatPercent(share, lang) })}
        />
      )}

      <div className="text-right text-[13px] tabular-nums text-base-content/70">
        {share === null ? "" : formatPercent(share, lang)}
      </div>
      <div className="hidden text-right text-[13px] tabular-nums text-base-content/60 sm:block">
        {t("dashboard.weekBooked", { count: day.bookings })}
      </div>
    </li>
  );
}
