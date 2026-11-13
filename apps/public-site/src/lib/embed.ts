// R410: the protocol between the embeddable booking widget (packages/widget,
// running on a salon's own website) and the /embed pages it frames. The
// widget package defines the same message types in its src/protocol.ts — the
// two must stay in step.
//
// Every message goes from the embed page up to the host page, never the other
// way: the embed pages accept no input from whoever frames them. Messages are
// posted to any origin ("*") because the host is any salon's site; nothing in
// them is secret — a height, service ids, a booking's start time. The manage
// link, which *is* a credential, is never sent.

export type EmbedMessage =
  | { type: "booking-widget:resize"; height: number }
  | { type: "booking-widget:open"; serviceIds?: string[] }
  | { type: "booking-widget:close" }
  | { type: "booking-widget:booked"; startAt: string };

/** Is this site path ("/embed/medium?…") one of the frameable embed pages? */
export function isEmbedPath(path: string): boolean {
  return /^\/embed(\/|\?|$)/.test(path);
}

/** Running inside someone else's page, rather than opened directly? */
export function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Reading `top` across origins can throw; that itself means framed.
    return true;
  }
}

/** Tells the host page something. A no-op when not framed. */
export function postToHost(message: EmbedMessage): void {
  if (isFramed()) {
    window.parent.postMessage(message, "*");
  }
}
