// @ts-check
import { defineConfig, envField } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// R560: a fully static site — no server, nothing per request. Every value
// below is read at build time, so changing one means a rebuild (a redeploy).
export default defineConfig({
  // Canonical/hreflang links and the sitemap are built from this. Staging and
  // production each set their own.
  site: process.env.SITE_URL ?? "https://book-it.ge",
  trailingSlash: "ignore",
  env: {
    schema: {
      // Staging: every page says noindex and no sitemap is offered (R390 does
      // the same for the booking sites).
      BLOCK_SEARCH_ENGINES: envField.boolean({ context: "server", access: "public", default: false }),
      // R560: the API the plans are read from (GET /plans) at build time.
      // Unset: R470's starting plans, with a warning — except on Vercel, where
      // the build fails instead of printing prices that may be stale.
      API_URL: envField.string({ context: "server", access: "public", optional: true }),
      // Where "Sign in" goes.
      PUBLIC_CMS_URL: envField.string({ context: "client", access: "public", default: "https://cms.book-it.ge" }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
