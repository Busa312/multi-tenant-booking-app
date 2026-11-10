import type { Translate } from "@/i18n/locales";
import { formatInstant } from "@/lib/tenant-time";
import { VisitPlan, type VisitPlanRow } from "./VisitPlan";

interface BookingSummaryProps {
  startAt: string | null;
  /** Branch name and address, already in the visitor's language; null = no branches. */
  location: string | null;
  /** R200: who does what, when. */
  plan: VisitPlanRow[];
  /** Total, already summed — a string so money is never re-added as a float here. */
  total: string;
  timezone: string;
  locale: string;
  t: Translate;
}

const ROW = "flex flex-col gap-0.5 py-3 min-[26rem]:flex-row min-[26rem]:gap-4";
const TERM = "text-sm text-base-content/60 min-[26rem]:w-28 min-[26rem]:flex-none";

// The booking as one card: used before booking (details step) and after
// (confirmation), so the customer sees the same thing on both sides.
export function BookingSummary({ startAt, location, plan, total, timezone, locale, t }: BookingSummaryProps) {
  return (
    <dl className="divide-y divide-base-300 rounded-box border border-base-300 bg-base-200/50 px-4">
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

      <div className={ROW}>
        <dt className={TERM}>{t("booking.summary.total")}</dt>
        <dd className="text-lg font-bold tabular-nums">{total} ₾</dd>
      </div>
    </dl>
  );
}
