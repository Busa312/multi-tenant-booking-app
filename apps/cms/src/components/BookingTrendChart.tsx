import { useI18n } from "../i18n/I18nContext.js";
import { cx } from "../lib/cx.js";
import type { BookingTrend } from "../lib/dashboardStats.js";
import { dayOfMonth, formatDateLabel } from "../lib/tenantTime.js";
import { TREND_AXIS, TREND_BAR_SHAPE, TREND_COLUMN, TREND_FIGURE, TREND_RAIL } from "../lib/trendChartClasses.js";
import { BookingTrendTable } from "./BookingTrendTable.js";
import { Card, Eyebrow } from "./ui/index.js";

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
      return <p className="mt-4 text-base-content/60">{t("dashboard.trendEmpty")}</p>;
    }

    if (nonZeroDays < 2 && peakPoint) {
      return (
        <p className="mt-4 text-base-content/60">
          {t("dashboard.trendSingleDay", { count: total, date: formatDateLabel(peakPoint.date, lang) })}
        </p>
      );
    }

    return (
      <figure className={TREND_FIGURE}>
        <figcaption className="mb-2.5 text-xs text-base-content/60">
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
        <div className={TREND_RAIL} aria-hidden="true">
          {points.map((point, index) => {
            const isToday = index === points.length - 1;
            // A 6% floor keeps a count of 1 beside a peak of 40 legible; the
            // exact figure is always in the title and the table, so the floor
            // can't mislead. Zero days get a hairline tick instead of nothing,
            // otherwise a gap reads as missing data rather than a quiet day.
            const pct = point.count === 0 ? 0 : Math.max(6, Math.round((point.count / scaleMax) * 100));
            return (
              <div
                key={point.date}
                // Today is marked by an underline on the baseline, not a
                // different hue — colour isn't carrying meaning here.
                className={cx(
                  TREND_COLUMN,
                  isToday && "relative after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary",
                )}
                title={t("dashboard.trendBar", { date: formatDateLabel(point.date, lang), count: point.count })}
              >
                {point.count === 0 ? (
                  <div className="h-px w-full bg-base-300 sm:max-w-3.5" />
                ) : (
                  <div
                    className={cx(
                      TREND_BAR_SHAPE,
                      "bg-primary/85 transition-[height] duration-300 hover:bg-primary motion-reduce:transition-none",
                      isToday && "bg-primary",
                    )}
                    // Bar height is the one genuinely dynamic value.
                    style={{ height: `${pct}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* 30 dates can't fit; the ends anchor the axis and the table has the rest. */}
        <div className={TREND_AXIS} aria-hidden="true">
          <span>{first ? dayOfMonth(first.date) : ""}</span>
          <span>{last ? t("dashboard.trendToday") : ""}</span>
        </div>

        <details className="mt-3">
          <summary className="w-fit cursor-pointer text-xs font-semibold text-primary pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center">
            {t("dashboard.trendShowTable")}
          </summary>
          <BookingTrendTable trend={trend} />
        </details>
      </figure>
    );
  }

  return (
    <Card>
      <Eyebrow>{t("dashboard.trendTitle")}</Eyebrow>
      <div className="mt-0.5 font-display text-lg font-semibold">{t("dashboard.trendSubtitle")}</div>
      {body()}
      {excludedNote && <p className="mt-3 text-xs text-base-content/55">{excludedNote}</p>}
    </Card>
  );
}
