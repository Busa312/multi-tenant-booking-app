import { useI18n } from "../i18n/I18nContext.js";
import type { BookingTrend } from "../lib/dashboardStats.js";
import { formatDateLabel } from "../lib/tenantTime.js";

interface BookingTrendTableProps {
  trend: BookingTrend;
}

/**
 * The chart's text alternative, and the only place the exact daily numbers are
 * readable. A real table rather than a visually-hidden block: 30 sr-only rows
 * dumped into the reading order help nobody, and a sighted keyboard user who
 * wants the figures has no way to reach something only screen readers can see.
 * It scrolls inside itself rather than stretching the dashboard grid.
 */
export function BookingTrendTable({ trend }: BookingTrendTableProps) {
  const { t, lang } = useI18n();

  return (
    <div className="mt-2.5 max-h-64 overflow-y-auto rounded-field border border-base-300">
      <table className="table table-sm table-pin-rows">
        <caption className="px-3 py-2 text-left text-xs text-base-content/60">
          {t("dashboard.trendTableCaption")}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t("dashboard.trendColDate")}</th>
            <th scope="col" className="text-right">
              {t("dashboard.trendColCount")}
            </th>
          </tr>
        </thead>
        <tbody>
          {trend.points.map((point) => (
            <tr key={point.date}>
              <td>{formatDateLabel(point.date, lang)}</td>
              <td className="text-right tabular-nums">{point.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
