import { useState } from "react";
import { useI18n } from "../i18n/I18nContext.js";
import { usePushNotifications } from "../lib/usePushNotifications.js";
import { InstallAppModal } from "./InstallAppModal.js";
import { Icon } from "./ui/Icon.js";

const ROW = "gap-3 rounded-field px-3 py-2 font-medium text-base-content/70";

// R620: the sidebar row that switches push notifications on or off for this
// device. Nothing at all where they can't work (or the API has them off).
export function PushNotificationsMenuItem() {
  const { t } = useI18n();
  const { state, busy, failed, turnOn, turnOff } = usePushNotifications();
  const [installOpen, setInstallOpen] = useState(false);

  if (state === null || state === "unavailable") return null;

  if (state === "denied") {
    return (
      <li className="menu-disabled">
        <div className={ROW} title={t("push.blockedHint")}>
          <Icon name="notifications_off" />
          <span className="flex flex-col">
            {t("push.blocked")}
            <span className="text-xs font-normal text-base-content/55">{t("push.blockedHint")}</span>
          </span>
        </div>
      </li>
    );
  }

  const on = state === "on";
  // The dialog sits beside the row, not in it: daisyUI's menu styles every child of an <li>.
  return (
    <>
      <li>
        <button
          type="button"
          className={ROW}
          disabled={busy}
          aria-pressed={state === "needs-install" ? undefined : on}
          title={on ? undefined : t("push.turnOnHint")}
          onClick={state === "needs-install" ? () => setInstallOpen(true) : on ? turnOff : turnOn}
        >
          <Icon name={on ? "notifications_active" : "notifications"} />
          <span className="flex flex-col items-start">
            {t(on ? "push.turnOff" : "push.turnOn")}
            {failed && <span className="text-xs font-normal text-error">{t("push.failed")}</span>}
          </span>
        </button>
      </li>
      {installOpen && <InstallAppModal onClose={() => setInstallOpen(false)} />}
    </>
  );
}
