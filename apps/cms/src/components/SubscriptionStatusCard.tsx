import type { SubscriptionOverview, SubscriptionStatus } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { formatInstantDate } from "../lib/tenantTime.js";
import { Button, Card, Eyebrow, Pill, type PillTone } from "./ui/index.js";

interface SubscriptionStatusCardProps {
  overview: SubscriptionOverview;
  timezone: string;
  busy: boolean;
  onCancel: () => void;
  onResume: () => void;
}

const TONE: Record<SubscriptionStatus, PillTone> = {
  free: "success",
  trial: "neutral",
  active: "success",
  past_due: "warning",
  lapsed: "danger",
};

const STATUS_KEY: Record<SubscriptionStatus, string> = {
  free: "subscription.statusFree",
  trial: "subscription.statusTrial",
  active: "subscription.statusActive",
  past_due: "subscription.statusPastDue",
  lapsed: "subscription.statusLapsed",
};

/** R480: where the salon stands — trial, paid through, due or paused — and cancelling or resuming. */
export function SubscriptionStatusCard({ overview, timezone, busy, onCancel, onResume }: SubscriptionStatusCardProps) {
  const { t, lang } = useI18n();
  const date = (iso: string) => formatInstantDate(iso, timezone, lang);
  const plan = overview.plans.find((candidate) => candidate.id === overview.planId);
  const paying = overview.paidThrough !== null && (overview.status === "active" || overview.status === "past_due");
  const nextPlanName = overview.nextPlanId ? t(`subscription.plan_${overview.nextPlanId}`) : null;

  const lines: string[] = [];
  if (overview.status === "free") lines.push(t("subscription.free"));
  if (overview.status === "trial") lines.push(t("subscription.trialEnds", { date: date(overview.trialEndsAt) }), t("subscription.trialHint"));
  if (overview.status === "active" && overview.paidThrough) {
    lines.push(t("subscription.paidThrough", { date: date(overview.paidThrough) }));
    if (overview.cancelAtPeriodEnd) lines.push(t("subscription.cancelledEnds", { date: date(overview.paidThrough) }));
    else if (nextPlanName) lines.push(t("subscription.switchesOn", { plan: nextPlanName, date: date(overview.paidThrough) }));
    else if (overview.card) lines.push(t("subscription.renewsOn", { date: date(overview.paidThrough) }));
  }
  if (overview.status === "past_due" && overview.graceEndsAt) {
    lines.push(t("subscription.pastDue", { date: date(overview.graceEndsAt) }));
    if (overview.card && overview.paidThrough && !overview.cancelAtPeriodEnd) lines.push(t("subscription.pastDueRetry"));
  }
  if (overview.status === "lapsed" && overview.bookingPaused) {
    lines.push(
      overview.cancelAtPeriodEnd && overview.paidThrough
        ? t("subscription.lapsedCancelled", { date: date(overview.paidThrough) })
        : t("subscription.lapsed"),
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>{t("subscription.currentPlan")}</Eyebrow>
          <div className="mt-0.5 font-display text-2xl leading-tight font-bold">
            {overview.status === "free"
              ? t("subscription.statusFree")
              : overview.status === "trial"
                ? t("subscription.statusTrial")
                : overview.paidThrough
                  ? t(`subscription.plan_${overview.planId}`)
                  : t("subscription.trialEnded")}
          </div>
        </div>
        <Pill tone={TONE[overview.status]}>{t(STATUS_KEY[overview.status])}</Pill>
      </div>

      {plan && overview.paidThrough && overview.status !== "free" && (
        <p className="mt-3">
          <span className="font-display text-5xl leading-none font-bold tabular-nums">{Number(plan.price)} ₾</span>
          <span className="ml-1.5 text-sm text-base-content/60">{t("subscription.perMonth")}</span>
        </p>
      )}

      <div className="mt-3 flex flex-col gap-1 text-sm text-base-content/70">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      {overview.status === "active" && paying && (
        <div className="mt-4">
          {overview.cancelAtPeriodEnd ? (
            <Button variant="secondary" icon="undo" disabled={busy} onClick={onResume}>
              {t("subscription.resumeBtn")}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
              {t("subscription.cancelBtn")}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
