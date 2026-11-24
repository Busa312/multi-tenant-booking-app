import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import { readPushState, switchOffPush, switchOnPush, syncPush, type PushState } from "./pushNotifications.js";

interface PushNotifications {
  /** null until known. */
  state: PushState | null;
  busy: boolean;
  /** Switching on failed for a reason other than the person saying no. */
  failed: boolean;
  turnOn: () => void;
  turnOff: () => void;
}

/**
 * R620: this device's push switch. While signed in, a device that is on is
 * saved again for the current login and CMS language, so notifications follow
 * whoever signed in last and speak the language the CMS shows.
 */
export function usePushNotifications(): PushNotifications {
  const { session } = useAuth();
  const { lang } = useI18n();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const signedIn = session !== null;

  useEffect(() => {
    if (!signedIn) return undefined;
    let live = true;
    syncPush(lang)
      .catch(() => undefined)
      .then(readPushState)
      .then((next) => {
        if (live) setState(next);
      })
      .catch(() => {
        if (live) setState("unavailable");
      });
    return () => {
      live = false;
    };
  }, [signedIn, lang]);

  const turnOn = useCallback(() => {
    setBusy(true);
    setFailed(false);
    switchOnPush(lang)
      .then(setState)
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  }, [lang]);

  const turnOff = useCallback(() => {
    setBusy(true);
    setFailed(false);
    switchOffPush()
      .then(readPushState)
      .then(setState)
      .catch(() => setState("off"))
      .finally(() => setBusy(false));
  }, []);

  return { state, busy, failed, turnOn, turnOff };
}
