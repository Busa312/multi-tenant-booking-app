import { withSentryConfig } from "@sentry/nextjs";

const production = process.env.NODE_ENV === "production";
// The CMS embeds this site in an iframe for its live colour preview, so it —
// and only it — may frame these pages.
const cmsOrigin = process.env.NEXT_PUBLIC_CMS_ORIGIN ?? "";
// R390: staging keeps search engines out (src/lib/search-indexing.ts reads the same variable).
const blockSearchEngines = process.env.BLOCK_SEARCH_ENGINES?.trim().toLowerCase() === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // shared-types/api-client are unbuilt TS workspace packages — Next needs to transpile them itself.
  transpilePackages: ["@booking/api-client", "@booking/shared-types"],
  // Lets a production build run beside `next dev` without sharing .next
  // (the two clobber each other). Unset everywhere but that case.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // Loads src/instrumentation.ts — server-side Sentry (system_design.md §12a).
    instrumentationHook: true,
    // Server-side Sentry pulls in OpenTelemetry, which webpack can't bundle
    // cleanly; loaded from node_modules at runtime instead.
    serverComponentsExternalPackages: ["@sentry/nextjs", "@sentry/node", "@sentry/opentelemetry"],
  },
  async redirects() {
    return [
      // Browsers and crawlers ask for /favicon.ico whatever the page declares:
      // send them to the salon's own icon (app/tenant-icon.svg) rather than a page.
      { source: "/favicon.ico", destination: "/tenant-icon.svg", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Content-Security-Policy", value: `frame-ancestors 'self' ${cmsOrigin}`.trim() },
          ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
          // Not a robots.txt "Disallow": a crawler has to fetch a page to see noindex.
          ...(blockSearchEngines ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
        ],
      },
      {
        // The manage link *is* the credential; it must never leave in a Referer.
        source: "/manage/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      // R410: the embed pages exist to be framed by salons' own websites, which
      // can be any site. Listed after the catch-all above, so they override its
      // frame-ancestors; every other page still refuses to be framed.
      { source: "/embed/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] },
      { source: "/:locale/embed/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] },
      {
        // R160: the same page under a language prefix (/ka/manage/…)
        source: "/:locale/manage/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

// Error tracking. Only wired in when a browser DSN is configured: the SDK costs
// every page ~40 kB of JavaScript, which a deployment that doesn't report
// shouldn't pay. Source maps upload only with SENTRY_AUTH_TOKEN (CI).
const sentryOptions = {
  silent: true,
  telemetry: false,
  disableLogger: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Errors only: keep tracing, replay and debug code out of every page's
  // JavaScript (the public site's P95 < 300ms target).
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeTracing: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN ? withSentryConfig(nextConfig, sentryOptions) : nextConfig;
