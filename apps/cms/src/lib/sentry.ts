import * as Sentry from "@sentry/react";
import { scrubBreadcrumb, scrubEvent } from "@booking/shared-types";

/**
 * Error tracking (system_design.md §12a). Off unless VITE_SENTRY_DSN is set,
 * so development needs nothing. No PII by default: what a crash report needs
 * is the stack, not who was signed in.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    sendDefaultPii: false,
    // Reset and invite links carry credentials in the path.
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

/** Reports an error the UI caught (no-op without a DSN). */
export function reportError(error: unknown, componentStack?: string | null): void {
  Sentry.captureException(error, componentStack ? { contexts: { react: { componentStack } } } : undefined);
}
