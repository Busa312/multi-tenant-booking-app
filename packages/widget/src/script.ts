/**
 * The <script> tag build (dist/booking-widget.js): the same API on
 * `window.BookingWidget`, and every `[data-booking-widget]` element on the page
 * mounted once it is parsed. Importing the package does none of this — a site
 * with a bundler calls mount() when it is ready.
 */
import { mountAll } from "./auto.js";

export * from "./index.js";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => mountAll(), { once: true });
} else {
  mountAll();
}
