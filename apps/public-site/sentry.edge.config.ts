import * as Sentry from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent } from "@booking/shared-types";

// Edge (middleware) error tracking (system_design.md §12a). Off without a DSN.
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    // Manage-link tokens ride in page and request URLs.
    beforeSend: (event) => {
      scrubEvent(event);
      return event;
    },
    beforeBreadcrumb: (breadcrumb) => {
      scrubBreadcrumb(breadcrumb);
      return breadcrumb;
    },
    tracesSampleRate: 0,
  });
}
