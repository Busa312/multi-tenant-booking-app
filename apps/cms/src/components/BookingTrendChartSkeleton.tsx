import { useI18n } from "../i18n/I18nContext.js";
import { TREND_DAYS } from "../lib/dashboardStats.js";
import { TREND_AXIS, TREND_BAR_SHAPE, TREND_COLUMN, TREND_FIGURE, TREND_RAIL } from "../lib/trendChartClasses.js";
import { Card, Skeleton } from "./ui/index.js";

/**
 * Fixed bar heights, in percent of the rail. A repeating pattern rather than
 * `Math.random()`: the placeholder should look the same on every render, and a
 * chart that reshuffles itself while you wait is worse than one that doesn't
 * move at all.
 */
const BAR_HEIGHTS = [38, 62, 45, 78, 30, 55, 71, 42, 66, 34];

/**
 * The trend card's stand-in. Its layout classes come from trendChartClasses —
 * the same source the real chart uses — because reserving exactly the chart's
 * height is this component's whole job.
 */
export function BookingTrendChartSkeleton() {
  const { t } = useI18n();

  return (
    <Card role="status" aria-busy="true" aria-label={t("common.loading")}>
      <Skeleton width="34%" height="11px" />
      <Skeleton width="56%" height="22px" className="mt-1.5" />

      <div className={TREND_FIGURE}>
        <Skeleton width="48%" height="12.5px" className="mb-2.5" />

        <div className={TREND_RAIL}>
          {Array.from({ length: TREND_DAYS }, (_, index) => (
            <div key={index} className={TREND_COLUMN}>
              {/* noUncheckedIndexedAccess: the modulo can't overflow, but the
                  index signature is still optional. */}
              <Skeleton className={TREND_BAR_SHAPE} height={`${BAR_HEIGHTS[index % BAR_HEIGHTS.length] ?? 50}%`} />
            </div>
          ))}
        </div>

        <div className={TREND_AXIS}>
          <Skeleton width="52px" height="11.5px" />
          <Skeleton width="52px" height="11.5px" />
        </div>
      </div>
    </Card>
  );
}
