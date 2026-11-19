import type { APIRoute } from "astro";
import { BLOCK_SEARCH_ENGINES } from "astro:env/server";
import { locales, localeHome, messagesFor } from "../i18n";

export const GET: APIRoute = ({ site }) => {
  const url = (path: string) => new URL(path, site).href;
  // The pages worth finding: the home page and the contact page (R580), in every language.
  const pages = ["", "contact/"];
  const alternates = (page: string) =>
    locales.map((l) => `<xhtml:link rel="alternate" hreflang="${messagesFor(l).htmlLang}" href="${url(localeHome(l) + page)}"/>`).join("");
  const entries = BLOCK_SEARCH_ENGINES
    ? ""
    : pages.flatMap((page) => locales.map((l) => `<url><loc>${url(localeHome(l) + page)}</loc>${alternates(page)}</url>`)).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries}</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
