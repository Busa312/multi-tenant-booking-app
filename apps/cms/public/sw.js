// R620: the CMS's service worker. It only shows push notifications and opens
// the CMS when one is tapped — no caching, so the CMS never runs stale code.
// Plain JS served as-is from public/: it is not bundled.

const FALLBACK_TITLE = "Book-it";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** Only a path inside the CMS: a payload never sends anyone elsewhere. */
function cmsPath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Not JSON: still show something rather than nothing (Safari revokes push for silent ones).
  }
  const title = typeof data.title === "string" && data.title ? data.title : FALLBACK_TITLE;
  const tag = typeof data.tag === "string" ? data.tag : undefined;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      tag,
      // A newer alert about the same visit replaces the old one, and still makes a sound.
      renotify: tag !== undefined,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: cmsPath(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(cmsPath(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        await open.navigate(url).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
