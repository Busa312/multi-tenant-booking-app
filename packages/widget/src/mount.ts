import { openOverlay } from "./overlay.js";
import { readMessage } from "./protocol.js";
import type { WidgetHandle, WidgetOptions, WidgetSize } from "./types.js";
import { embedUrl, siteOrigin } from "./url.js";

// Height before the frame reports its own, so the page doesn't jump far.
const INITIAL_HEIGHT: Record<WidgetSize, number> = { full: 640, medium: 420, small: 96 };
const SIZES: readonly WidgetSize[] = ["full", "medium", "small"];

/**
 * Puts a booking widget into `target` (an element, or a CSS selector for one).
 * The widget is an iframe of the salon's booking site, kept exactly as tall as
 * its content; medium and small open the full flow over the page.
 */
export function mount(target: Element | string, options: WidgetOptions): WidgetHandle {
  const host = typeof target === "string" ? document.querySelector(target) : target;
  if (!host) {
    throw new Error(`BookingWidget: no element matches "${String(target)}"`);
  }
  const size: WidgetSize = options.size && SIZES.includes(options.size) ? options.size : "full";
  const origin = siteOrigin(options.site);
  const title = options.title ?? "Online booking";

  const frame = document.createElement("iframe");
  frame.src = embedUrl(origin, size, options);
  frame.title = title;
  frame.loading = size === "full" ? "eager" : "lazy";
  // The frame is the widget's whole surface; corners for the compact cards.
  frame.style.cssText = [
    "display:block",
    "width:100%",
    "border:0",
    `height:${INITIAL_HEIGHT[size]}px`,
    size === "full" ? "" : "border-radius:12px",
    "color-scheme:normal",
  ]
    .filter(Boolean)
    .join(";");

  const open = (serviceIds?: string[]) =>
    openOverlay(
      embedUrl(origin, "full", { ...options, serviceIds: serviceIds ?? options.serviceIds, overlay: true }),
      origin,
      title,
      (detail) => booked(detail),
    );

  const booked = (detail: { startAt: string }) => {
    options.onBooked?.(detail);
    host.dispatchEvent(new CustomEvent("booking-widget:booked", { detail, bubbles: true }));
  };

  const onMessage = (event: MessageEvent) => {
    const message = readMessage(event, origin, frame);
    if (!message) return;
    if (message.type === "booking-widget:resize") frame.style.height = `${Math.ceil(message.height)}px`;
    if (message.type === "booking-widget:open") open(message.serviceIds);
    if (message.type === "booking-widget:booked") booked({ startAt: message.startAt });
  };

  window.addEventListener("message", onMessage);
  host.replaceChildren(frame);

  return {
    open: (openOptions) => open(openOptions?.serviceIds),
    destroy: () => {
      window.removeEventListener("message", onMessage);
      frame.remove();
    },
  };
}

/**
 * Opens the full booking flow over the page without placing a widget — for a
 * salon's own "Book now" button.
 */
export function openBooking(options: Omit<WidgetOptions, "size">): void {
  const origin = siteOrigin(options.site);
  openOverlay(
    embedUrl(origin, "full", { ...options, overlay: true }),
    origin,
    options.title ?? "Online booking",
    options.onBooked,
  );
}
