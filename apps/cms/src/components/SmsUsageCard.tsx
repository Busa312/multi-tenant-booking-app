import type { SubscriptionOverview } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { cx } from "../lib/cx.js";
import { formatInstantDate, formatMonthLabel, tenantDateString } from "../lib/tenantTime.js";
import { Card, Eyebrow } from "./ui/index.js";

interface SmsUsageCardProps {
  overview: SubscriptionOverview;
  timezone: string;
}

// From here the bar turns to a warning: the allowance is nearly used (as the banner does).
const NEARLY_FULL = 0.8;

/**
 * R500: texts sent on the salon's behalf — booking codes and booking links,
 * counted as the SMS parts they're billed as — against the plan's allowance,
 * over the salon's billing month (the calendar month outside one). Texts
 * beyond it cost 0.07 ₾ each, added to the next monthly payment.
 */
export function SmsUsageCard({ overview, timezone }: SmsUsageCardProps) {
  const { t, lang } = useI18n();
  const { sms } = overview;
  const date = (iso: string) => formatInstantDate(iso, timezone, lang);
  const share = sms.included > 0 ? sms.used / sms.included : 0;
  const label = t("subscription.smsUsed", { used: sms.used, included: sms.included });
  // The window's last moment, for "1 – 30 November"-style ranges (its end is exclusive).
  const lastDay = new Date(new Date(sms.periodEnd).getTime() - 1).toISOString();

  // Why extra texts in this window won't be charged, when they won't.
  const notChargedKey =
    overview.status === "trial" || (overview.status === "active" && !sms.billingMonth)
      ? "subscription.smsNotChargedTrial"
      : overview.status === "free"
        ? "subscription.smsNotChargedFree"
        : overview.cancelAtPeriodEnd
          ? "subscription.smsNotChargedCancelled"
          : "subscription.smsNotCharged";

  return (
    <Card>
      <Eyebrow>
        {sms.billingMonth
          ? t("subscription.smsTitleBilling")
          : t("subscription.smsTitle", { month: formatMonthLabel(tenantDateString(timezone, new Date(sms.periodStart)), lang) })}
      </Eyebrow>
      <div className="mt-0.5 font-display text-2xl leading-tight font-bold tabular-nums">{label}</div>
      <progress
        className={cx(
          "progress mt-4 h-2.5 rounded-none",
          sms.extra > 0 ? "progress-error" : share >= NEARLY_FULL ? "progress-warning" : "progress-primary",
        )}
        value={Math.min(sms.used, sms.included)}
        max={Math.max(sms.included, 1)}
        aria-label={label}
      />
      <p className="mt-1.5 text-xs text-base-content/60 tabular-nums">
        {sms.billingMonth
          ? t("subscription.smsPeriod", { from: date(sms.periodStart), to: date(lastDay) })
          : t("subscription.smsResets", { date: date(sms.periodEnd) })}
      </p>

      {sms.extra > 0 &&
        (sms.billable ? (
          <p className="mt-3 text-sm font-semibold text-error">
            {t("subscription.smsExtraCharged", { count: sms.extra, amount: sms.extraAmount, date: date(sms.periodEnd) })}
          </p>
        ) : (
          <p className="mt-3 text-sm font-semibold">{t(notChargedKey, { count: sms.extra })}</p>
        ))}

      <p className="mt-3 text-sm text-base-content/60">{t("subscription.smsHint", { price: sms.extraTextPrice })}</p>
    </Card>
  );
}
