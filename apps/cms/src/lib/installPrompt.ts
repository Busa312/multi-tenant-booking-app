/**
 * R620: the browser's own "install this app" prompt. Chrome, Edge and Android
 * browsers announce it once, early, with `beforeinstallprompt` — often before
 * the install page has mounted — so it is caught at start-up and kept here.
 * Safari and Firefox never send it: they have no prompt a page can open.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

/** Call once, as early as possible (main.tsx). */
export function captureInstallPrompt(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep it for our button instead of the browser's own mini-bar.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

export const canPromptInstall = (): boolean => deferred !== null;

export const installedThisVisit = (): boolean => installedNow;

/** Running as the installed app rather than in a browser tab. */
export const runningInstalled = (): boolean =>
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone, iPod, or an iPad (which reports itself as a Mac, with a touch screen). */
export const isIosDevice = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Opens the browser's prompt; true when the person chose to install. A prompt can be shown only once. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome === "accepted";
}

export function onInstallPromptChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
