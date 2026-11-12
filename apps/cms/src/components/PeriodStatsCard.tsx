import type { DashboardPeriod } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { parsePriceMinor } from "../lib/dashboardStats.js";
import {
  DASHBOARD_PERIOD_DAYS,
  formatChange,
  formatPercent,
  formatWholeAmount,
  ratio,
  relativeChange,
} from "../lib/dashboardSummary.js";
import { PeriodStat, type StatChangeTone } from "./PeriodStat.js";
import { Card, Eyebrow } from "./ui/index.js";

interface PeriodStatsCardProps {
  current: DashboardPeriod;
  previous: DashboardPeriod;
}

// Two groups of three, so each value has room on a tablet before the group
// turns horizontal; on a phone both stack. Three equal columns (not daisyUI's
// size-to-content ones) keep the dividers of both rows aligned, including when
// a professional login's second row has only two stats.
const GROUP = "stats stats-vertical w-full bg-base-200/50 md:stats-horizontal md:grid-cols-3";

/**
 * R370: the last 30 days against the 30 before. Counts compare as a relative
 * change; rates as "was N%", since "+50%" of a 2% no-show rate says less than
 * the two figures side by side. The value tile appears only when the API sent
 * one, which it never does for a professional login.
 */
export function PeriodStatsCard({ current, previous }: PeriodStatsCardProps) {
  const { t, lang } = useI18n();
  const number = (value: number) => new Intl.NumberFormat(lang).format(value);

  /** A count's change. `higherIsBetter` decides the colour, never the wording. */
  const countChange = (now: number, before: number) => {
    const change = relativeChange(now, before);
    if (change === null) return { text: t("dashboard.changeNoData"), tone: "neutral" as StatChangeTone };
    const tone: StatChangeTone = change > 0 ? "good" : change < 0 ? "bad" : "neutral";
    return { text: t("dashboard.changeVsPrevious", { change: formatChange(change, lang) }), tone };
  };

  const rateChange = (now: number | null, before: number | null, higherIsBetter: boolean) => {
    if (now === null || before === null) return undefined;
    const nowShown = formatPercent(now, lang);
    const beforeShown = formatPercent(before, lang);
    const better = higherIsBetter ? now > before : now < before;
    const tone: StatChangeTone = nowShown === beforeShown ? "neutral" : better ? "good" : "bad";
    return { text: t("dashboard.changeWas", { value: beforeShown }), tone };
  };

  const online = ratio(current.onlineBookings, current.bookings);
  const noShow = ratio(current.noShows, current.completed + current.noShows);
  const cancelled = ratio(current.cancelled, current.appointments);

  const valueNow = current.completedValue === null ? null : parsePriceMinor(current.completedValue);
  const valueBefore = previous.completedValue === null ? null : parsePriceMinor(previous.completedValue);

  return (
    <Card>
      <Eyebrow>{t("dashboard.periodTitle", { days: DASHBOARD_PERIOD_DAYS })}</Eyebrow>
      <div className="mt-0.5 font-display text-lg font-semibold">
        {t("dashboard.periodSubtitle", { days: DASHBOARD_PERIOD_DAYS })}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className={GROUP}>
          <PeriodStat
            title={t("dashboard.statBookings")}
            value={number(current.bookings)}
            change={countChange(current.bookings, previous.bookings)}
          />
          <PeriodStat
            title={t("dashboard.statOnline")}
            value={online === null ? t("dashboard.noValue") : formatPercent(online, lang)}
            detail={t("dashboard.statOnlineDetail", { count: current.onlineBookings, total: current.bookings })}
            change={rateChange(online, ratio(previous.onlineBookings, previous.bookings), true)}
          />
          <PeriodStat
            title={t("dashboard.statNewClients")}
            value={number(current.newClients)}
            detail={t("dashboard.statReturning", { count: current.returningClients })}
            change={countChange(current.newClients, previous.newClients)}
          />
        </div>

        <div className={GROUP}>
          <PeriodStat
            title={t("dashboard.statNoShows")}
            value={noShow === null ? t("dashboard.noValue") : formatPercent(noShow, lang)}
            detail={
              noShow === null
                ? t("dashboard.statNothingMarked")
                : t("dashboard.statNoShowsDetail", {
                    count: current.noShows,
                    total: current.completed + current.noShows,
                  })
            }
            change={rateChange(noShow, ratio(previous.noShows, previous.completed + previous.noShows), false)}
          />
          <PeriodStat
            title={t("dashboard.statCancelled")}
            value={cancelled === null ? t("dashboard.noValue") : formatPercent(cancelled, lang)}
            detail={t("dashboard.statCancelledDetail", { count: current.cancelled, total: current.appointments })}
            change={rateChange(cancelled, ratio(previous.cancelled, previous.appointments), false)}
          />
          {current.completedValue !== null && valueNow !== null && (
            <PeriodStat
              title={t("dashboard.statValue")}
              value={t("dashboard.statValueAmount", { amount: formatWholeAmount(current.completedValue, lang) })}
              detail={t("dashboard.statValueDetail", { count: current.completed })}
              change={countChange(valueNow, valueBefore ?? 0)}
            />
          )}
        </div>
      </div>

      {/* Completed, never collected: the site is reservation-only and clients
          pay in person, so the wording has to rule out reading this as takings. */}
      {current.completedValue !== null && (
        <p className="mt-3 text-xs leading-relaxed text-base-content/55">{t("dashboard.statValueNote")}</p>
      )}
    </Card>
  );
}
