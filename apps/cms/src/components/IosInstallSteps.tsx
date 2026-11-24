import { useI18n } from "../i18n/I18nContext.js";

// R620: iPhone and iPad install a web app only by hand, from Safari's Share menu.
export function IosInstallSteps() {
  const { t } = useI18n();
  return (
    <ol className="list-decimal space-y-2 pl-5">
      <li>{t("push.installStep1")}</li>
      <li>{t("push.installStep2")}</li>
      <li>{t("push.installStep3")}</li>
    </ol>
  );
}
