import { useState } from "react";
import type { OnboardingStatus } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { Alert, Field, InputGroup } from "./ui/index.js";

interface SetupStepLiveProps {
  status: OnboardingStatus;
  siteUrl: string | null;
}

// Without these the booking site can't take a single booking.
const NEEDED_TO_BOOK = ["hours", "services", "team"] as const;

/**
 * R420 step 6: the booking site's address to share, a test booking, and —
 * when something essential was skipped — what still stands between the salon
 * and its first online booking.
 */
export function SetupStepLive({ status, siteUrl }: SetupStepLiveProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const missing = NEEDED_TO_BOOK.filter((id) => !status.steps.find((step) => step.id === id)?.done);

  async function copy() {
    if (!siteUrl) return;
    try {
      await navigator.clipboard.writeText(siteUrl);
      setCopied(true);
    } catch {
      // Clipboard refused (permissions, insecure origin): the field is selectable.
    }
  }

  return (
    <>
      <p className="text-base-content/70">{t("setup.liveIntro")}</p>

      {missing.length > 0 && (
        <Alert variant="warning" className="mt-3">
          {t("setup.liveMissing", { steps: missing.map((id) => t(`setup.step_${id}`)).join(", ") })}
        </Alert>
      )}

      {siteUrl && (
        <>
          <Field label={t("setup.liveAddress")} htmlFor="setup-site-url" className="mt-4">
            <InputGroup
              id="setup-site-url"
              value={siteUrl}
              readOnly
              onFocus={(event) => event.target.select()}
              action={{ label: copied ? t("setup.copied") : t("common.copy"), onClick: () => void copy() }}
            />
          </Field>
          <p className="text-sm">
            <a className="link" href={`${siteUrl}/book`} target="_blank" rel="noopener noreferrer">
              {t("setup.liveTest")} <span aria-hidden="true">↗</span>
            </a>
          </p>
        </>
      )}
    </>
  );
}
