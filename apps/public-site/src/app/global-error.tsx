"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * The last-resort boundary: replaces the root layout when it throws, so it
 * renders its own document. Reports the error (no-op without a DSN) and offers
 * a reload. Deliberately plain — the tenant's theme came from the layout that
 * just failed.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1rem", textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>Please reload the page. If it keeps happening, try again a little later.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </body>
    </html>
  );
}
