import { useCallback, useEffect, useState } from "react";
import {
  canPromptInstall,
  installedThisVisit,
  isIosDevice,
  onInstallPromptChange,
  promptInstall,
  runningInstalled,
} from "./installPrompt.js";

/**
 * R620: how this device can get the app.
 * - `installed`: already running as the app, or just installed from here.
 * - `prompt`: the browser has an install prompt our button can open.
 * - `ios`: iPhone/iPad, installed by hand (Share → Add to Home Screen).
 * - `manual`: anything else — the browser's menu, if it can install at all.
 */
export type InstallWay = "installed" | "prompt" | "ios" | "manual";

const currentWay = (): InstallWay =>
  runningInstalled() || installedThisVisit() ? "installed" : canPromptInstall() ? "prompt" : isIosDevice() ? "ios" : "manual";

export function useInstallApp(): { way: InstallWay; installing: boolean; install: () => void } {
  const [way, setWay] = useState<InstallWay>(currentWay);
  const [installing, setInstalling] = useState(false);

  useEffect(() => onInstallPromptChange(() => setWay(currentWay())), []);

  const install = useCallback(() => {
    setInstalling(true);
    promptInstall()
      .catch(() => false)
      .finally(() => {
        setInstalling(false);
        setWay(currentWay());
      });
  }, []);

  return { way, installing, install };
}
