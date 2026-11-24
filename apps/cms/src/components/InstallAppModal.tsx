import { useI18n } from "../i18n/I18nContext.js";
import { Modal } from "./Modal.js";
import { Button } from "./ui/Button.js";
import { IosInstallSteps } from "./IosInstallSteps.js";

interface InstallAppModalProps {
  onClose: () => void;
}

// R620: on iPhone and iPad, Web Push works only in the Home Screen app — the
// steps to get there, in place of a switch that couldn't work.
export function InstallAppModal({ onClose }: InstallAppModalProps) {
  const { t } = useI18n();
  return (
    <Modal
      title={t("push.installTitle")}
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          {t("common.done")}
        </Button>
      }
    >
      <p className="mb-4">{t("push.installIntro")}</p>
      <div className="mb-4">
        <IosInstallSteps />
      </div>
      <p className="text-sm text-base-content/60">{t("push.installNote")}</p>
    </Modal>
  );
}
