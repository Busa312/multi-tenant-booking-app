import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";
import { LoginPage } from "./pages/Login.js";
import { RouteFallback } from "./components/RouteFallback.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";

/**
 * Route chunks, split out of the entry bundle.
 *
 * Before this the CMS shipped as one file: reaching the login form meant
 * downloading the bookings calendar, the weekly schedule editor and every
 * page-specific modal first. Vite emits one chunk per `import()` below.
 *
 * `LoginPage` is deliberately *not* in here. It is the guaranteed cold-start
 * route for any new session, so splitting it would buy nothing on the load that
 * matters most and cost an extra round trip before the password field paints.
 */
const chunks = {
  setPassword: () => import("./pages/SetPassword.js"),
  dashboard: () => import("./pages/Dashboard.js"),
  bookings: () => import("./pages/Bookings.js"),
  branding: () => import("./pages/BrandingSettings.js"),
  professionals: () => import("./pages/Professionals.js"),
  services: () => import("./pages/Services.js"),
  hours: () => import("./pages/Hours.js"),
};

// `lazy` resolves a module's default export; CMS components are named exports
// (repo convention), so each import is mapped across.
const SetPasswordPage = lazy(() => chunks.setPassword().then((m) => ({ default: m.SetPasswordPage })));
const DashboardPage = lazy(() => chunks.dashboard().then((m) => ({ default: m.DashboardPage })));
const BookingsPage = lazy(() => chunks.bookings().then((m) => ({ default: m.BookingsPage })));
const BrandingSettingsPage = lazy(() => chunks.branding().then((m) => ({ default: m.BrandingSettingsPage })));
const ProfessionalsPage = lazy(() => chunks.professionals().then((m) => ({ default: m.ProfessionalsPage })));
const ServicesPage = lazy(() => chunks.services().then((m) => ({ default: m.ServicesPage })));
const HoursPage = lazy(() => chunks.hours().then((m) => ({ default: m.HoursPage })));

/**
 * Everything reachable from the sidebar, warmed in the background once someone
 * is signed in.
 *
 * Without this, splitting would trade a smaller first load for a blank screen
 * on every *first* visit to a route — each page renders its own `AppShell`, so
 * the sidebar unmounts into the fallback while the chunk downloads. Fetching
 * them up front means the chunk is almost always already in memory by the time
 * anyone clicks, which keeps the win and drops the cost. `set-password` is
 * excluded: it is reachable only from an invite link, never from the nav.
 */
const NAV_CHUNKS = [
  chunks.dashboard,
  chunks.bookings,
  chunks.branding,
  chunks.professionals,
  chunks.services,
  chunks.hours,
];

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

// UI-only gate (R10/R20 acceptance criterion: option "not available/visible"
// to professionals) — actual enforcement is RolesGuard on the API side.
function RequireOwner({ children }: { children: React.ReactElement }) {
  const { role } = useAuth();
  return role === "owner" ? children : <Navigate to="/" replace />;
}

export function App() {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const warm = () => {
      // A prefetch that fails is not worth surfacing: navigating to the route
      // retries the import, and the Suspense boundary covers it from there.
      // Swallowing it here only stops an unhandled rejection.
      for (const load of NAV_CHUNKS) void load().catch(() => undefined);
    };

    // Idle time where it exists, so warming never competes with the landing
    // route's own data fetches. Safari still ships no requestIdleCallback.
    if (typeof requestIdleCallback === "function") {
      const handle = requestIdleCallback(warm);
      return () => cancelIdleCallback(handle);
    }
    const timer = setTimeout(warm, 1_000);
    return () => clearTimeout(timer);
  }, [token]);

  return (
    // Outside Suspense, so a chunk that never arrives is caught rather than
    // suspending forever behind the fallback.
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/set-password/:tenantId/:token" element={<SetPasswordPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          {/* Owner and professional both manage bookings (R10/R20) — the API scopes
              a professional's view to their own appointments, so no owner gate. */}
          <Route
            path="/bookings"
            element={
              <RequireAuth>
                <BookingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/settings/colors"
            element={
              <RequireAuth>
                <RequireOwner>
                  <BrandingSettingsPage />
                </RequireOwner>
              </RequireAuth>
            }
          />
          <Route
            path="/professionals"
            element={
              <RequireAuth>
                <RequireOwner>
                  <ProfessionalsPage />
                </RequireOwner>
              </RequireAuth>
            }
          />
          <Route
            path="/services"
            element={
              <RequireAuth>
                <RequireOwner>
                  <ServicesPage />
                </RequireOwner>
              </RequireAuth>
            }
          />
          <Route
            path="/hours"
            element={
              <RequireAuth>
                <RequireOwner>
                  <HoursPage />
                </RequireOwner>
              </RequireAuth>
            }
          />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
