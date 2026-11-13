/**
 * R410: the booking widget — a salon's online booking on its own website, in
 * the palette and languages it set in the CMS.
 *
 *   import { mount } from "@booking/widget";
 *   mount("#booking", { site: "https://demo.platform.ge", size: "medium" });
 *
 * or, with no build step, the <script> build (script.ts) and
 * `data-booking-widget` elements (auto.ts). The widget frames the salon's
 * booking site, so it needs no API key and keeps the site's phone
 * verification, holds and limits.
 */
export { mount, openBooking } from "./mount.js";
export { mountAll } from "./auto.js";
export type { BookedDetail, WidgetHandle, WidgetOptions, WidgetSize } from "./types.js";
