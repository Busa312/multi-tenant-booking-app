import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Content-Security-Policy for the built CMS, as a <meta> tag — the CMS is
 * static files, so there's no server of ours to send the header. Build only:
 * the dev server injects inline scripts (React refresh) a strict policy would
 * block. The JWT lives in localStorage, so this is what stands between an
 * injected script and a stolen session (system_design.md §12a).
 *
 * frame-ancestors can't be set from a meta tag; the host should send
 * `Content-Security-Policy: frame-ancestors 'none'` as a header.
 */
function contentSecurityPolicy(env: Record<string, string>): Plugin {
  const api = env.VITE_API_URL ?? "";
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    // Inline styles: Leaflet and a few dynamic values (chart bar heights) set them.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // Tenant logos may be hosted anywhere over https; map tiles come from OSM.
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${api} https://nominatim.openstreetmap.org https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io`,
    // The branding page previews the tenant's public site in an iframe.
    `frame-src ${env.VITE_PUBLIC_SITE_PROTOCOL ?? "https"}://*.${env.VITE_PUBLIC_SITE_BASE_DOMAIN ?? ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: (html) =>
      html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), tailwindcss(), contentSecurityPolicy(env)],
    server: {
      port: 5173,
    },
  };
});
