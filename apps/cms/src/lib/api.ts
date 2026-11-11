import { CmsApiClient } from "@booking/api-client";

/** Dispatched on `window` when the API rejects our session; AuthContext listens. */
export const SESSION_EXPIRED_EVENT = "booking:session-expired";

// Standalone from AuthContext so it can be imported by non-component code too.
// R320: no token anywhere in here — the browser sends the httpOnly session
// cookie by itself (`credentials: "include"`), and every request carries the
// header the API's CSRF guard requires on writes.
export const cmsApiClient = new CmsApiClient({
  baseUrl: import.meta.env.VITE_API_URL,
  credentials: "include",
  getExtraHeaders: () => ({ "X-Requested-With": "booking-cms" }),
  // A 401 on an authenticated call means the JWT is expired, revoked or bogus —
  // there's nothing to retry, so drop the token and let AuthContext bounce the
  // user to the login screen. Without this each page's catch-all turns an
  // expired session into "could not load…", leaving the CMS looking signed in.
  // /cms/auth/* is exempt: a rejected login is a 401 about *credentials*, and
  // treating it as a dead session would swap the "wrong password" message for
  // a spurious "session expired" one.
  onUnauthorized: (path) => {
    if (path.startsWith("/cms/auth/")) return;
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  },
});
