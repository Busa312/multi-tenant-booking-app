import type { APIRoute } from "astro";
import { BLOCK_SEARCH_ENGINES } from "astro:env/server";

// Staging offers no sitemap; its pages carry noindex instead of being
// disallowed here, since a crawler has to fetch a page to see that.
export const GET: APIRoute = ({ site }) => {
  const lines = ["User-agent: *", "Allow: /"];
  if (!BLOCK_SEARCH_ENGINES) lines.push("", `Sitemap: ${new URL("/sitemap.xml", site).href}`);
  return new Response(`${lines.join("\n")}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
