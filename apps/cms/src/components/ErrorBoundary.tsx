import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorScreen, type ErrorKind } from "./ErrorScreen.js";

/**
 * Lowercased substrings of the message browsers use when a dynamic `import()`
 * cannot be fetched. There is no error code to test and no shared wording, so
 * matching text is the only option available:
 *
 *   Chrome/Edge  Failed to fetch dynamically imported module: <url>
 *   Firefox      error loading dynamically imported module: <url>
 *   Safari       Importing a module script failed.
 *
 * A miss here is not fatal — it only means a chunk failure is described as a
 * crash rather than as a stale tab, and the reload button still fixes it.
 */
const CHUNK_ERROR_FRAGMENTS = [
  "dynamically imported module",
  "importing a module script failed",
  "failed to fetch dynamically",
];

function classify(error: unknown): ErrorKind {
  const message = error instanceof Error ? error.message : String(error);
  const haystack = message.toLowerCase();
  return CHUNK_ERROR_FRAGMENTS.some((fragment) => haystack.includes(fragment)) ? "stale" : "crash";
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  kind: ErrorKind | null;
}

/**
 * Catches anything thrown while rendering a route, including a lazy chunk that
 * failed to download (see App.tsx) — before this, a deploy that replaced the
 * hashed filenames an open tab still pointed at white-screened the CMS.
 *
 * The only class component in the codebase, and not by preference: React 18
 * exposes error boundaries solely through `getDerivedStateFromError` /
 * `componentDidCatch`, with no hook equivalent (React 19 does not change this).
 * Everything renderable lives in `ErrorScreen` so the class stays this short.
 *
 * There is deliberately no "try again" that resets state. `React.lazy` caches
 * a rejected import, so re-rendering the same lazy component re-throws the
 * cached failure forever — a retry button would look like it worked and never
 * do anything. Reloading is the honest action, and it is also the one that
 * actually fixes the common cause, since it fetches a fresh index.html with
 * current chunk hashes.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { kind: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { kind: classify(error) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // No error reporting service is wired up yet; the console is what a
    // developer reproducing a report has to work with.
    console.error("Unhandled error in the route tree:", error, info.componentStack);
  }

  override render(): ReactNode {
    const { kind } = this.state;
    if (kind === null) {
      return this.props.children;
    }
    return <ErrorScreen kind={kind} onReload={() => window.location.reload()} />;
  }
}
