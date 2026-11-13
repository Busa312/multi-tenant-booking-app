import { Link } from "react-router-dom";
import type { OnboardingStatus } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { doneCount } from "../lib/setupSteps.js";
import { Button, ButtonLink, Card, Eyebrow, Pill } from "./ui/index.js";

interface SetupProgressCardProps {
  status: OnboardingStatus;
  busy: boolean;
  onDismiss: () => void;
}

/**
 * R420: the owner's way back into the setup until it is finished or
 * dismissed — how far along it is, and each step still open.
 */
export function SetupProgressCard({ status, busy, onDismiss }: SetupProgressCardProps) {
  const { t } = useI18n();
  const done = doneCount(status);
  const total = status.steps.length;
  const open = status.steps.filter((step) => !step.done);

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0">
          <Eyebrow>{t("setup.cardEyebrow")}</Eyebrow>
          <div className="mt-0.5 font-display text-2xl leading-tight font-bold">{t("setup.progress", { done, total })}</div>
        </div>
        <div className="ml-auto flex flex-none gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onDismiss}>
            {t("setup.hide")}
          </Button>
          <ButtonLink to="/setup" size="sm" icon="arrow_forward">
            {t("setup.resume")}
          </ButtonLink>
        </div>
      </div>

      <progress className="progress progress-primary mt-3 h-2 rounded-none" value={done} max={total} aria-hidden="true" />

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
        {open.map((step) => (
          <li key={step.id} className="flex items-center gap-1.5 text-sm">
            <Link className="link link-hover font-medium" to={`/setup?step=${step.id}`}>
              {t(`setup.step_${step.id}`)}
            </Link>
            {step.skipped && <Pill>{t("setup.stateSkipped")}</Pill>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
