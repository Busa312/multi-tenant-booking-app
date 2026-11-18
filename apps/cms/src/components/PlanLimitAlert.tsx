import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nContext.js";
import { Alert, ButtonLink } from "./ui/index.js";

interface PlanLimitAlertProps {
  /** Open locations the plan includes. */
  limit: number;
}

/** R540: the plan's location limit is reached — and the way to a bigger plan. */
export function PlanLimitAlert({ limit }: PlanLimitAlertProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  // It appears in answer to a click that may be far away (a long form's footer): bring it into view.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest" });
  }, []);
  return (
    <Alert variant="warning">
      <div ref={ref} className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>{limit === 1 ? t("locations.errPlanLimitOne") : t("locations.errPlanLimit", { count: limit })}</span>
        <ButtonLink to="/settings/subscription" size="sm" variant="secondary">
          {t("locations.seePlans")}
        </ButtonLink>
      </div>
    </Alert>
  );
}
