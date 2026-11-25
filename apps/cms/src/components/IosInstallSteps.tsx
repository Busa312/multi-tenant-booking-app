import type { ReactNode } from "react";
import { useI18n } from "../i18n/I18nContext.js";
import { iosBrowser } from "../lib/iosBrowser.js";
import type { IconName } from "../lib/iconNames.js";
import { Icon } from "./ui/Icon.js";

const SHARE_STEP = {
  safari: "push.installStepSafari",
  safariMore: "push.installStepSafariMore",
  chrome: "push.installStepChrome",
  other: "push.installStepOther",
} as const;

/** A step's text with its `{placeholder}` drawn as the icon people look for on screen. */
function withIcon(text: string, placeholder: string, icon: IconName): ReactNode {
  const [before, after] = text.split(`{${placeholder}}`);
  if (after === undefined) return text;
  return (
    <>
      {before}
      <Icon name={icon} size={18} className="mx-0.5 align-[-0.2em] text-base-content" />
      {after}
    </>
  );
}

// R620: iPhone and iPad install a web app only by hand, from the browser's
// Share menu — which each browser keeps somewhere else.
export function IosInstallSteps() {
  const { t } = useI18n();
  const { browser, shareBehindMore } = iosBrowser();
  const shareStep = browser === "safari" ? (shareBehindMore ? SHARE_STEP.safariMore : SHARE_STEP.safari) : SHARE_STEP[browser];
  return (
    <ol className="list-decimal space-y-2 pl-5">
      <li>{withIcon(t(shareStep), "share", "ios_share")}</li>
      <li>{withIcon(t("push.installStep2"), "add", "add_box")}</li>
      <li>{t("push.installStep3")}</li>
    </ol>
  );
}
