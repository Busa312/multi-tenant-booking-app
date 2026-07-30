import type { CSSProperties } from "react";
import { useI18n } from "../i18n/I18nContext.js";
import { cx } from "../lib/cx.js";
import type { BookingTrend } from "../lib/dashboardStats.js";
import { dayOfMonth, formatDateLabel } from "../lib/tenantTime.js";
import { BookingTrendTable } from "./BookingTrendTable.js";
import { Card, Eyebrow } from "./ui/index.js";
import styles from "./BookingTrendChart.module.css";

interface BookingTrendChartProps {
  trend: BookingTrend;
}

/**
 * Daily bookings over the trend window, as bars.
 *
 * Hand-rolled on purpose: a charting library would be the repo's first, for one
 * single-series 30-bar chart. The bars are decoration — `BookingTrendTable`
 * carries the actual numbers, and the figcaption carries the shape in a
 * sentence, so nothing here is the only route to the data.
 *
 * Below two non-empty days there is no shape to see, so the chart degrades to a
 * sentence: a one-bar bar chart is a stat tile wearing an axis.
 */
export function BookingTrendChart({ trend }: BookingTrendChartProps) {
  const { t, lang } = useI18n();
  const { points, total, peak, peakPoint, nonZeroDays, scaleMax, excludedTotal } = trend;

  // noUncheckedIndexedAccess: both ends are `TrendPoint | undefined`.
  const first = points[0];
  const last = points[points.length - 1];

  const excludedNote =
    excludedTotal > 0
      ? t(excludedTotal === 1 ? "dashboard.excludedNote_one" : "dashboard.excludedNote_other", {
          count: excludedTotal,
        })
      : null;

  function body() {
    if (total === 0) {
      return <p className={styles.empty}>{t("dashboard.trendEmpty")}</p>;
    }

    if (nonZeroDays < 2 && peakPoint) {
      return (
        <p className={styles.single}>
          {t("dashboard.trendSingleDay", { count: total, date: formatDateLabel(peakPoint.date, lang) })}
        </p>
      );
    }

    return (
      <figure className={styles.figure}>
        <figcaption className={styles.figcaption}>
          {peakPoint
            ? t("dashboard.trendSummary", {
                total,
                peakDate: formatDateLabel(peakPoint.date, lang),
                peak,
              })
            : t("dashboard.trendSubtitle")}
        </figcaption>

        {/* Decorative: the numbers live in the caption above and the table
            below, so the bars themselves are hidden from assistive tech. */}
        <div className={styles.rail} aria-hidden="true">
          {points.map((point, index) => {
            // A 6% floor keeps a count of 1 beside a peak of 40 legible; the
            // exact figure is always in the title and the table, so the floor
            // can't mislead. Zero days get a hairline tick instead of nothing,
            // otherwise a gap reads as missing data rather than a quiet day.
            const pct = point.count === 0 ? 0 : Math.max(6, Math.round((point.count / scaleMax) * 100));
            return (
              <div
                key={point.date}
                className={cx(styles.column, index === points.length - 1 && styles.columnToday)}
                title={t("dashboard.trendBar", { date: formatDateLabel(point.date, lang), count: point.count })}
              >
                {point.count === 0 ? (
                  <div className={styles.zeroTick} />
                ) : (
                  <div className={styles.bar} style={{ "--bar": `${pct}%` } as CSSProperties} />
                )}
              </div>
            );
          })}
        </div>

        {/* 30 dates can't fit; the ends anchor the axis and the table has the rest. */}
        <div className={styles.axis} aria-hidden="true">
          <span>{first ? dayOfMonth(first.date) : ""}</span>
          <span>{last ? t("dashboard.trendToday") : ""}</span>
        </div>

        <details className={styles.details}>
          <summary className={styles.summary}>{t("dashboard.trendShowTable")}</summary>
          <BookingTrendTable trend={trend} />
        </details>
      </figure>
    );
  }

  return (
    <Card className={styles.card}>
      <Eyebrow>{t("dashboard.trendTitle")}</Eyebrow>
      <div className={styles.subtitle}>{t("dashboard.trendSubtitle")}</div>
      {body()}
      {excludedNote && <p className={styles.footnote}>{excludedNote}</p>}
    </Card>
  );
}
