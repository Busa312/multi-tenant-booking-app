import type { Translate } from "@/i18n/locales";
import { formatInstant } from "@/lib/tenant-time";
import { priceText } from "@/lib/price";
import { SUMMARY, SUMMARY_ROW as ROW, SUMMARY_TERM as TERM } from "@/lib/wizardClasses";
import { VisitPlan, type VisitPlanRow } from "./VisitPlan";

interface BookingSummaryProps {
  startAt: string | null;
  /** Branch name and address, already in the visitor's language; null = no branches. */
  location: string | null;
  /** R200: who does what, when. */
  plan: VisitPlanRow[];
  /** Total, already summed — a string so money is never re-added as a float here. */
  total: string;
  /** R520: the total includes a starting price — shown as "from". */
  totalFrom: boolean;
  /** R630: the home-visit fee, already in `total`, shown on its own line; null/"0" = none. */
  homeVisitFee?: string | null;
  timezone: string;
  locale: string;
  t: Translate;
}

// The booking as one receipt: used before booking (details step) and after
// (confirmation), so the customer sees the same thing on both sides.
export function BookingSummary({ startAt, location, plan, total, totalFrom, homeVisitFee, timezone, locale, t }: BookingSummaryProps) {
  return (
    <dl className={SUMMARY}>
      {startAt && (
        <div className={ROW}>
          <dt className={TERM}>{t("booking.summary.when")}</dt>
          <dd className="min-w-0 font-medium">{formatInstant(startAt, timezone, locale)}</dd>
        </div>
      )}

      {location && (
        <div className={ROW}>
          <dt className={TERM}>{t("booking.summary.location")}</dt>
          <dd className="min-w-0 font-medium">{location}</dd>
        </div>
      )}

      {plan.length > 0 && (
        <div className={ROW}>
          <dt className={TERM}>{t("booking.summary.schedule")}</dt>
          <dd className="-mb-3 min-w-0">
            <VisitPlan rows={plan} timezone={timezone} locale={locale} t={t} />
          </dd>
        </div>
      )}

      {homeVisitFee && Number(homeVisitFee) > 0 && (
        <div className={ROW}>
          <dt className={TERM}>{t("booking.summary.homeVisitFee")}</dt>
          <dd className="font-medium tabular-nums">{priceText(t, homeVisitFee, false)}</dd>
        </div>
      )}

      <div className={ROW}>
        <dt className={TERM}>{t("booking.summary.total")}</dt>
        <dd className="text-xl font-semibold tabular-nums">{priceText(t, total, totalFrom)}</dd>
      </div>
    </dl>
  );
}
