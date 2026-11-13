import type { WidgetSize } from "./types.js";

/** The site's origin, or an error if it isn't an http(s) URL. */
export function siteOrigin(site: string): string {
  let url: URL;
  try {
    url = new URL(site);
  } catch {
    throw new Error(`BookingWidget: "site" must be a full URL such as "https://salon.example.ge", got "${site}"`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`BookingWidget: "site" must be an http(s) URL, got "${site}"`);
  }
  return url.origin;
}

const LOCALE = /^[a-z]{2}$/;

/** The embed page for a size, in a language, with any preselection. */
export function embedUrl(
  origin: string,
  size: WidgetSize,
  options: { locale?: string; serviceIds?: string[]; locationId?: string; overlay?: boolean },
): string {
  // A language prefix the salon doesn't publish in redirects to its main language.
  const prefix = options.locale && LOCALE.test(options.locale) ? `/${options.locale}` : "";
  const query = new URLSearchParams();
  if (options.serviceIds && options.serviceIds.length > 0) query.set("serviceIds", options.serviceIds.join(","));
  if (options.locationId) query.set("locationId", options.locationId);
  if (options.overlay) query.set("overlay", "1");
  const search = query.toString();
  return `${origin}${prefix}/embed/${size}${search ? `?${search}` : ""}`;
}
