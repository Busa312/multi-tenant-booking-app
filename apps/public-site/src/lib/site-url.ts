import { headers } from "next/headers";
import { SITE_PATH_HEADER } from "./locale-path";

/** The origin this request was made to ("https://salon.example.ge") — each salon has its own. */
export function siteOrigin(): string {
  const incoming = headers();
  const host = incoming.get("host") ?? "";
  const forwarded = incoming.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const local = /^(localhost|127\.0\.0\.1|\[::1\]|[^:]+\.localhost)(:\d+)?$/.test(host);
  return `${forwarded ?? (local ? "http" : "https")}://${host}`;
}

/** The path and query of this request without its language prefix (set by the middleware). */
export function sitePath(): string {
  return headers().get(SITE_PATH_HEADER) ?? "/";
}
