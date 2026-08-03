import { useI18n } from "../i18n/I18nContext.js";
import { TREND_DAYS } from "../lib/dashboardStats.js";
import { Card, Skeleton } from "./ui/index.js";
import chart from "./BookingTrendChart.module.css";
import styles from "./BookingTrendChartSkeleton.module.css";

/**
 * Fixed bar heights, in percent of the rail. A repeating pattern rather than
 * `Math.random()`: the placeholder should look the same on every render, and a
 * chart that reshuffles itself while you wait is worse than one that doesn't
 * move at all.
 */
const BAR_HEIGHTS = [38, 62, 45, 78, 30, 55, 71, 42, 66, 34];

/**
 * The trend card's stand-in.
 *
 * Structural classes come from `BookingTrendChart.module.css` — the same
 * stylesheet the real chart uses — rather than being re-declared here. The rail
 * is 108px tall and 92px below 520px wide, and those numbers reserving the
 * right space is the entire job of this component; copying them would mean a
 * future tweak to the chart silently reintroduces the shift. Sharing the rule
 * is the one deviation from "every component owns its styles" that the CLS
 * guarantee actually depends on.
 */
export function BookingTrendChartSkeleton() {
  const { t } = useI18n();

  return (
    <Card className={chart.card} role="status" aria-busy="true" aria-label={t("common.loading")}>
      <Skeleton width="34%" height="11px" />
      <Skeleton width="56%" height="13px" className={styles.subtitle} />

      <div className={chart.figure}>
        <Skeleton width="48%" height="12.5px" className={styles.figcaption} />

        <div className={chart.rail}>
          {Array.from({ length: TREND_DAYS }, (_, index) => (
            <div key={index} className={chart.column}>
              {/* noUncheckedIndexedAccess: the modulo can't overflow, but the
                  index signature is still optional. */}
              <Skeleton className={styles.bar} height={`${BAR_HEIGHTS[index % BAR_HEIGHTS.length] ?? 50}%`} />
            </div>
          ))}
        </div>

        <div className={chart.axis}>
          <Skeleton width="52px" height="11.5px" />
          <Skeleton width="52px" height="11.5px" />
        </div>
      </div>
    </Card>
  );
}
