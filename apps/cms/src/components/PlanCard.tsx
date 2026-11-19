import type { SubscriptionPlan } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { cx } from "../lib/cx.js";
import { Button, Icon, Pill } from "./ui/index.js";

interface PlanCardProps {
  plan: SubscriptionPlan;
  /** The plan the salon pays for now. */
  current: boolean;
  /** A chip beside the name: "Current", "From next renewal". */
  badge: string | null;
  action: { label: string; disabled: boolean; onClick: () => void };
  /** Why the plan can't be chosen right now (R540: the salon has more locations than it includes). */
  note?: string | null;
}

/** One plan on the Subscription page (R470): what it costs, what it includes, and the way onto it. */
export function PlanCard({ plan, current, badge, action, note }: PlanCardProps) {
  const { t } = useI18n();

  // R540
  function locationsFeature(): string {
    if (plan.maxLocations === null) return t("subscription.featureManyLocations");
    if (plan.maxLocations === 1) return t("subscription.featureOneLocation");
    return t("subscription.featureUpToLocations", { count: plan.maxLocations });
  }

  const features = [
    t("subscription.featureBooking"),
    locationsFeature(),
    ...(plan.id === "early" || plan.id === "early_pro" ? [t("subscription.featureEarlyPrice")] : []),
    ...(plan.prioritySupport ? [t("subscription.featurePriority")] : []),
  ];

  return (
    <article className={cx("flex h-full flex-col gap-3 rounded-field border p-4", current ? "border-primary bg-base-200/60" : "border-base-300")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xl leading-tight font-bold">{t(`subscription.plan_${plan.id}`)}</h3>
        {badge && <Pill tone={current ? "success" : "neutral"}>{badge}</Pill>}
      </div>

      <p>
        <span className="font-display text-4xl leading-none font-bold tabular-nums">{Number(plan.price)} ₾</span>
        <span className="ml-1 text-sm text-base-content/60">{t("subscription.perMonth")}</span>
      </p>

      <ul className="flex flex-1 flex-col gap-1.5 text-sm">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Icon name="check" size={18} />
            {feature}
          </li>
        ))}
      </ul>

      {note && <p className="text-sm text-base-content/60">{note}</p>}

      <Button variant={current ? "secondary" : "primary"} fullWidth disabled={action.disabled} onClick={action.onClick}>
        {action.label}
      </Button>
    </article>
  );
}
