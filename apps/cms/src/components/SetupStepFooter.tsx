import type { ReactNode } from "react";
import { useI18n } from "../i18n/I18nContext.js";
import { Button } from "./ui/index.js";

interface SetupStepFooterProps {
  done: boolean;
  skipped: boolean;
  /** What skipping means for this step, e.g. "We work from one place". */
  skipLabel?: string;
  busy?: boolean;
  onSkip: () => void;
  onContinue: () => void;
  /** Replaces the Continue button (the last step's "Finish setup"). */
  primary?: ReactNode;
  /** The last step can't be skipped — finishing is the point of it. */
  skippable?: boolean;
}

/** R420: every step ends the same way — skip it for now, or move on once it's done. */
export function SetupStepFooter({
  done,
  skipped,
  skipLabel,
  busy,
  onSkip,
  onContinue,
  primary,
  skippable = true,
}: SetupStepFooterProps) {
  const { t } = useI18n();

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-base-300 pt-4">
      <div>
        {skippable && !done && !skipped && (
          <Button variant="ghost" disabled={busy} onClick={onSkip}>
            {skipLabel ?? t("setup.skip")}
          </Button>
        )}
        {skipped && <span className="text-sm text-base-content/60">{t("setup.skippedNote")}</span>}
      </div>
      {primary ?? (
        <Button icon="arrow_forward" disabled={busy || (!done && !skipped)} onClick={onContinue}>
          {t("setup.continue")}
        </Button>
      )}
    </div>
  );
}
