import { useI18n } from "../i18n/I18nContext.js";
import type { BookingTrend } from "../lib/dashboardStats.js";
import { formatDateLabel } from "../lib/tenantTime.js";
import styles from "./BookingTrendTable.module.css";

interface BookingTrendTableProps {
  trend: BookingTrend;
}

/**
 * The chart's text alternative, and the only place the exact daily numbers are
 * readable. A real table rather than a visually-hidden block: 30 sr-only rows
 * dumped into the reading order help nobody, and a sighted keyboard user who
 * wants the figures has no way to reach something only screen readers can see.
 * Its own file because it has to be correct independently of the bars.
 */
export function BookingTrendTable({ trend }: BookingTrendTableProps) {
  const { t, lang } = useI18n();

  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <caption className={styles.caption}>{t("dashboard.trendTableCaption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("dashboard.trendColDate")}</th>
            <th scope="col" className={styles.numeric}>
              {t("dashboard.trendColCount")}
            </th>
          </tr>
        </thead>
        <tbody>
          {trend.points.map((point) => (
            <tr key={point.date}>
              <td>{formatDateLabel(point.date, lang)}</td>
              <td className={styles.numeric}>{point.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
