import * as Sentry from "@sentry/node";
import { scrubBreadcrumb, scrubEvent } from "./observability/redact.js";

/**
 * Error tracking (system_design.md §12a). Imported first in main.ts — Sentry
 * has to initialise before the modules it instruments are loaded. Without
 * SENTRY_DSN nothing is sent and every Sentry call is a no-op, so local
 * development and tests need no setup.
 */
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE,
    // Errors only by default; tracing is opt-in because it costs per request.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    // Customer names and phones never leave for a third party by default —
    // and the credentials in request URLs (manage links) are stripped.
    sendDefaultPii: false,
    beforeSend: (event) => {
      scrubEvent(event);
      return event;
    },
    beforeBreadcrumb: (breadcrumb) => {
      scrubBreadcrumb(breadcrumb);
      return breadcrumb;
    },
  });
}
