import { readMessage } from "./protocol.js";
import type { BookedDetail } from "./types.js";

const STYLE_ID = "booking-widget-style";
const DIALOG_CLASS = "booking-widget-dialog";

// The host page's own CSS is unknown, so the overlay's few rules are scoped to
// one class and injected once. Everything visible inside comes from the salon's
// booking site, in its palette.
const CSS = `
.${DIALOG_CLASS}{padding:0;border:0;margin:auto;width:min(600px,100vw);height:min(880px,100dvh);max-width:100vw;max-height:100dvh;border-radius:12px;overflow:hidden;background:transparent;box-shadow:0 24px 64px rgba(0,0,0,.35)}
.${DIALOG_CLASS}::backdrop{background:rgba(0,0,0,.55)}
.${DIALOG_CLASS} iframe{display:block;width:100%;height:100%;border:0}
@media (max-width:640px){.${DIALOG_CLASS}{width:100vw;height:100dvh;border-radius:0}}
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

let closeCurrent: (() => void) | null = null;

/**
 * Opens the full booking flow over the host page in a native modal <dialog>
 * (focus trap, Escape and an inert page behind it for free). One at a time:
 * opening another replaces it. Closes on Escape, a click on the backdrop, or
 * the close button inside the flow.
 */
export function openOverlay(src: string, origin: string, title: string, onBooked?: (detail: BookedDetail) => void): void {
  closeCurrent?.();
  ensureStyle();

  const dialog = document.createElement("dialog");
  dialog.className = DIALOG_CLASS;
  const frame = document.createElement("iframe");
  frame.src = src;
  frame.title = title;
  dialog.appendChild(frame);
  document.body.appendChild(dialog);

  const root = document.documentElement;
  const previousOverflow = root.style.overflow;
  root.style.overflow = "hidden";

  const onMessage = (event: MessageEvent) => {
    const message = readMessage(event, origin, frame);
    if (message?.type === "booking-widget:close") close();
    if (message?.type === "booking-widget:booked") onBooked?.({ startAt: message.startAt });
  };

  const close = () => {
    window.removeEventListener("message", onMessage);
    root.style.overflow = previousOverflow;
    if (dialog.open) dialog.close();
    dialog.remove();
    if (closeCurrent === close) closeCurrent = null;
  };

  window.addEventListener("message", onMessage);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  // A click that lands on the dialog itself, not its frame, is on the backdrop.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  closeCurrent = close;
  dialog.showModal();
}
