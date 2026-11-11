// Credentials that ride in URLs — the manage link (R230), password reset and
// invite links (R310/R50), hold ids (R250). Error reports carry page and
// request URLs; these are stripped first, because a report sitting in a
// third-party tool is as good as the credential for as long as it lives.
// Twin of packages/shared-types/src/redact.ts (the API can only `import type`
// from shared-types) — change both.

const REDACTED = "[redacted]";

const PATTERNS: readonly [RegExp, string][] = [
  [/(\/manage\/)(?!resend(?:[/?#]|$))[^/?#\s]+/g, `$1${REDACTED}`],
  [/(\/(?:reset|set)-password\/[^/?#\s]+\/)[^/?#\s]+/g, `$1${REDACTED}`],
  [/(\/holds\/)[^/?#\s]+/g, `$1${REDACTED}`],
  [/([?&](?:holdId|token)=)[^&#\s]+/g, `$1${REDACTED}`],
];

export function redactSecrets(text: string): string {
  return PATTERNS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

interface ScrubbableEvent {
  request?: { url?: string; query_string?: unknown; headers?: Record<string, string> };
  transaction?: string;
  breadcrumbs?: ScrubbableBreadcrumb[];
  exception?: { values?: { value?: string }[] };
  message?: string;
}

interface ScrubbableBreadcrumb {
  message?: string;
  data?: Record<string, unknown>;
}

/**
 * For Sentry's `beforeSend`: strips credentials from every URL-ish field of an
 * event, in place. Takes `unknown` and returns nothing on purpose — a generic
 * typed against Sentry's event types makes TypeScript compare two very large
 * structures and type-checking stalls. Use it as
 * `beforeSend: (event) => { scrubEvent(event); return event; }`.
 */
export function scrubEvent(input: unknown): void {
  if (!input || typeof input !== "object") return;
  const event = input as ScrubbableEvent;
  if (event.request) {
    if (event.request.url) event.request.url = redactSecrets(event.request.url);
    if (typeof event.request.query_string === "string") {
      event.request.query_string = redactSecrets(`?${event.request.query_string}`).slice(1);
    } else if (event.request.query_string) {
      event.request.query_string = undefined;
    }
    if (event.request.headers) {
      for (const name of ["referer", "Referer", "cookie", "Cookie"]) {
        if (event.request.headers[name]) event.request.headers[name] = REDACTED;
      }
    }
  }
  if (event.transaction) event.transaction = redactSecrets(event.transaction);
  if (event.message) event.message = redactSecrets(event.message);
  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = redactSecrets(value.value);
  }
  for (const breadcrumb of event.breadcrumbs ?? []) scrubBreadcrumb(breadcrumb);
}

/** For Sentry's `beforeBreadcrumb` (in place): navigation and fetch breadcrumbs carry URLs too. */
export function scrubBreadcrumb(input: unknown): void {
  if (!input || typeof input !== "object") return;
  const breadcrumb = input as ScrubbableBreadcrumb;
  if (breadcrumb.message) breadcrumb.message = redactSecrets(breadcrumb.message);
  if (breadcrumb.data) {
    for (const key of ["url", "from", "to"]) {
      const value = breadcrumb.data[key];
      if (typeof value === "string") breadcrumb.data[key] = redactSecrets(value);
    }
  }
}
