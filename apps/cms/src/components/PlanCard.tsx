import { useI18n } from "../i18n/I18nContext.js";
import type { Plan } from "../lib/subscriptionMock.js";
import { cx } from "../lib/cx.js";
import { Button, Icon, Pill } from "./ui/index.js";

interface PlanCardProps {
  plan: Plan;
  /** The plan the salon is on now. */
  current: boolean;
  onChoose: (plan: Plan) => void;
}

/** One plan on the Subscription page: what it costs, what it includes, and the way onto it. */
export function PlanCard({ plan, current, onChoose }: PlanCardProps) {
  const { t } = useI18n();
  const name = t(`subscription.plan_${plan.id}`);

  return (
    <article
      className={cx(
        "flex h-full flex-col gap-3 rounded-field border p-4",
        current ? "border-primary bg-base-200/60" : "border-base-300",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xl leading-tight font-bold">{name}</h3>
        {current && <Pill tone="success">{t("subscription.currentBadge")}</Pill>}
      </div>

      <p>
        <span className="font-display text-4xl leading-none font-bold tabular-nums">{plan.price} ₾</span>
        <span className="ml-1 text-sm text-base-content/60">{t("subscription.perMonth")}</span>
      </p>

      <ul className="flex flex-1 flex-col gap-1.5 text-sm">
        <li className="flex items-start gap-2">
          <Icon name="check" size={18} />
          {t("subscription.featureSms", { count: plan.smsIncluded })}
        </li>
        {plan.featureKeys.map((key) => (
          <li key={key} className="flex items-start gap-2">
            <Icon name="check" size={18} />
            {t(key)}
          </li>
        ))}
      </ul>

      <Button variant="secondary" fullWidth disabled={current} onClick={() => onChoose(plan)}>
        {current ? t("subscription.currentPlanButton") : t("subscription.switchTo", { plan: name })}
      </Button>
    </article>
  );
}
