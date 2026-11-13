import { mount } from "./mount.js";
import type { WidgetHandle, WidgetSize } from "./types.js";

const MOUNTED = "bookingWidgetMounted";

/**
 * Mounts every `<div data-booking-widget data-site="…">` on the page that
 * isn't mounted yet — the no-code way in:
 *
 *   <div data-booking-widget data-site="https://demo.platform.ge" data-size="medium" data-locale="ka"></div>
 *   <script src="…/booking-widget.js" defer></script>
 *
 * Optional: data-size (full | medium | small), data-locale, data-service-ids
 * (comma-separated), data-location-id, data-title. A broken element is
 * reported in the console and skipped; the others still mount.
 */
export function mountAll(root: ParentNode = document): WidgetHandle[] {
  const handles: WidgetHandle[] = [];
  root.querySelectorAll<HTMLElement>("[data-booking-widget]").forEach((element) => {
    if (element.dataset[MOUNTED]) return;
    const { site, size, locale, serviceIds, locationId, title } = element.dataset;
    if (!site) {
      console.error("BookingWidget: an element with data-booking-widget has no data-site", element);
      return;
    }
    try {
      handles.push(
        mount(element, {
          site,
          size: size as WidgetSize | undefined,
          locale,
          serviceIds: serviceIds ? serviceIds.split(",").map((id) => id.trim()).filter(Boolean) : undefined,
          locationId,
          title,
        }),
      );
      element.dataset[MOUNTED] = "true";
    } catch (error) {
      console.error(error);
    }
  });
  return handles;
}
