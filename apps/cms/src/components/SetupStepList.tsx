import type { OnboardingStatus, OnboardingStepId } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { cx } from "../lib/cx.js";
import { Icon } from "./ui/index.js";

interface SetupStepListProps {
  status: OnboardingStatus;
  current: OnboardingStepId;
  onSelect: (id: OnboardingStepId) => void;
}

/**
 * R420: every step of the setup, in order, each one a way back to it. The
 * highlighter marks where you are, as it does in the sidebar. On phones it is
 * one row of numbered steps naming only the current one, so the step itself
 * starts on the first screen.
 */
export function SetupStepList({ status, current, onSelect }: SetupStepListProps) {
  const { t } = useI18n();

  return (
    <ol className="flex gap-0.5 max-lg:overflow-x-auto max-lg:pb-1 lg:flex-col">
      {status.steps.map((step, index) => {
        const active = step.id === current;
        return (
          <li key={step.id} className="flex-none">
            <button
              type="button"
              aria-current={active ? "step" : undefined}
              className={cx(
                "flex w-full cursor-pointer items-center gap-3 rounded-field px-3 py-2.5 text-left max-lg:px-2 transition-colors motion-reduce:transition-none",
                active ? "bg-accent text-accent-content" : "hover:bg-base-300/50",
              )}
              onClick={() => onSelect(step.id)}
            >
              <span
                className={cx(
                  "grid size-7 flex-none place-items-center rounded-full border text-[13px] font-bold tabular-nums",
                  step.done ? "border-success bg-success text-success-content" : "border-base-content/30",
                )}
                aria-hidden="true"
              >
                {step.done ? <Icon name="check" size={16} /> : index + 1}
              </span>
              <span className={cx("min-w-0 flex-1", !active && "max-lg:sr-only")}>
                <span className="block truncate font-semibold">{t(`setup.step_${step.id}`)}</span>
                <span className={cx("block text-xs max-lg:hidden", active ? "opacity-75" : "text-base-content/60")}>
                  {t(step.done ? "setup.stateDone" : step.skipped ? "setup.stateSkipped" : "setup.stateTodo")}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
