// The messages the embed pages (apps/public-site src/lib/embed.ts) post up to
// this widget. Same shapes as over there — the two must stay in step.

export type WidgetMessage =
  | { type: "booking-widget:resize"; height: number }
  | { type: "booking-widget:open"; serviceIds?: string[] }
  | { type: "booking-widget:close" }
  | { type: "booking-widget:booked"; startAt: string };

/**
 * The booking site's own origin, allowing for one thing a host page can't be
 * expected to get right: an `http://` address the site upgrades to `https://`.
 * Any other host is someone else.
 */
function fromSite(eventOrigin: string, siteOrigin: string): boolean {
  if (eventOrigin === siteOrigin) return true;
  try {
    const actual = new URL(eventOrigin);
    const expected = new URL(siteOrigin);
    return expected.protocol === "http:" && actual.protocol === "https:" && actual.hostname === expected.hostname;
  } catch {
    return false;
  }
}

/**
 * The message if it came from our own frame — the booking site *and* that very
 * iframe, so another widget on the page (or any other frame) can't drive this
 * one — and has a shape we know. Null otherwise.
 */
export function readMessage(event: MessageEvent, origin: string, frame: HTMLIFrameElement): WidgetMessage | null {
  if (event.source !== frame.contentWindow || !fromSite(event.origin, origin)) {
    return null;
  }
  const data: unknown = event.data;
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const message = data as Record<string, unknown>;
  switch (message.type) {
    case "booking-widget:resize":
      return typeof message.height === "number" && Number.isFinite(message.height) && message.height >= 0
        ? { type: "booking-widget:resize", height: message.height }
        : null;
    case "booking-widget:open": {
      const ids = Array.isArray(message.serviceIds)
        ? message.serviceIds.filter((id): id is string => typeof id === "string")
        : undefined;
      return { type: "booking-widget:open", serviceIds: ids };
    }
    case "booking-widget:close":
      return { type: "booking-widget:close" };
    case "booking-widget:booked":
      return typeof message.startAt === "string" ? { type: "booking-widget:booked", startAt: message.startAt } : null;
    default:
      return null;
  }
}
