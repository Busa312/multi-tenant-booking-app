import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.js";
import { I18nProvider } from "./i18n/I18nContext.js";
import { App } from "./App.js";
import "./theme.css";

const RELOAD_KEY = "booking_cms_chunk_reload";

/**
 * How long a reload "counts for". A stale tab recovers on the first attempt,
 * so a second preload failure inside this window means reloading did not help
 * — the chunk is genuinely unreachable (bad deploy, CDN trouble, no network).
 * Reloading again from there is an infinite loop, so we stop and let the
 * ErrorBoundary render something the user can act on.
 */
const RELOAD_COOLDOWN_MS = 10_000;

/**
 * Vite fires this when a lazily-imported route chunk can't be fetched. Almost
 * always that means a deploy replaced the hashed filenames this tab is holding,
 * and a reload — which pulls a fresh index.html with current hashes — fixes it
 * before the user ever sees a failure.
 *
 * `preventDefault()` stops Vite rethrowing an error we are already handling;
 * when the cooldown blocks us we leave it alone on purpose, so the throw
 * propagates and the boundary catches it.
 */
window.addEventListener("vite:preloadError", (event) => {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
  if (Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS) return;

  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
);
