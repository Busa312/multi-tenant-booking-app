import { ApiError } from "@booking/api-client";
import type { PushLocale } from "@booking/shared-types";
import { cmsApiClient } from "./api.js";

/**
 * R620: push notifications on this device, as far as the CMS can tell.
 * - `unavailable`: this browser can't, or push isn't configured on the API: show nothing.
 * - `needs-install`: iPhone/iPad in a Safari tab, where push only works once the CMS is on the Home Screen.
 * - `denied`: the person blocked notifications for the CMS in the browser.
 * - `off` / `on`: whether this device is switched on.
 */
export type PushState = "unavailable" | "needs-install" | "denied" | "off" | "on";

const SERVICE_WORKER_URL = "/sw.js";

const supported = (): boolean =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** iPadOS reports itself as a Mac; a touch screen gives it away. */
const isIos = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = (): boolean =>
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Registered on every load, so the installed app always has its worker. */
export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    // A failed registration only means no notifications; the CMS works without it.
    navigator.serviceWorker.register(SERVICE_WORKER_URL).catch(() => undefined);
  });
}

let publicKeyRequest: Promise<string | null> | null = null;

/** The API's VAPID key, asked once per page; null = push is off on this API. */
function publicKey(): Promise<string | null> {
  publicKeyRequest ??= cmsApiClient
    .getPushConfig()
    .then((config) => config.publicKey)
    .catch(() => {
      publicKeyRequest = null;
      return null;
    });
  return publicKeyRequest;
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function subscribe(key: string): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
}

async function save(subscription: PushSubscription, locale: PushLocale): Promise<void> {
  const json = subscription.toJSON();
  await cmsApiClient.savePushSubscription({
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    locale,
  });
}

/**
 * Saves this browser's subscription for whoever is signed in. A 409 means it
 * is still registered under a login at another salon (signed out without
 * switching off): make a fresh one, which leaves the old one to die.
 */
async function saveOrRenew(subscription: PushSubscription, locale: PushLocale, key: string): Promise<void> {
  try {
    await save(subscription, locale);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 409) throw error;
    await subscription.unsubscribe();
    await save(await subscribe(key), locale);
  }
}

export async function readPushState(): Promise<PushState> {
  if (!supported()) return isIos() && !isStandalone() && (await publicKey()) ? "needs-install" : "unavailable";
  if (!(await publicKey())) return "unavailable";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  return (await currentSubscription()) ? "on" : "off";
}

/**
 * From a tap: Safari only shows the permission prompt in direct answer to
 * one, so permission is asked before anything else is awaited.
 */
export async function switchOnPush(locale: PushLocale): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "off";
  const key = await publicKey();
  if (!key) return "unavailable";
  const subscription = (await currentSubscription()) ?? (await subscribe(key));
  await saveOrRenew(subscription, locale, key);
  return "on";
}

/** Forgets this device on the API, then in the browser. Never throws: signing out relies on it. */
export async function switchOffPush(): Promise<void> {
  if (!supported()) return;
  try {
    const subscription = await currentSubscription();
    if (!subscription) return;
    await cmsApiClient.removePushSubscription({ endpoint: subscription.endpoint }).catch(() => undefined);
    await subscription.unsubscribe();
  } catch {
    // Nothing to switch off, or the browser refused: the API forgets it once the push service says it's gone.
  }
}

/**
 * On sign-in and on a language change: a device that is on is saved again for
 * whoever is signed in now, in the CMS's current language (R570), with their
 * current session (R320).
 */
export async function syncPush(locale: PushLocale): Promise<void> {
  if (!supported() || Notification.permission !== "granted") return;
  const [subscription, key] = await Promise.all([currentSubscription(), publicKey()]);
  if (!subscription || !key) return;
  await saveOrRenew(subscription, locale, key);
}
