import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";
import { LoginPage } from "./pages/Login.js";
import { RouteFallback } from "./components/RouteFallback.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";

const chunks = {
  setPassword: () => import("./pages/SetPassword.js"),
  forgotPassword: () => import("./pages/ForgotPassword.js"),
  resetPassword: () => import("./pages/ResetPassword.js"),
  dashboard: () => import("./pages/Dashboard.js"),
  bookings: () => import("./pages/Bookings.js"),
  branding: () => import("./pages/BrandingSettings.js"),
  professionals: () => import("./pages/Professionals.js"),
  services: () => import("./pages/Services.js"),
  locations: () => import("./pages/Locations.js"),
  publicSite: () => import("./pages/PublicSiteSettings.js"),
  hours: () => import("./pages/Hours.js"),
  subscription: () => import("./pages/Subscription.js"),
  blockedNumbers: () => import("./pages/BlockedNumbers.js"),
};

const SetPasswordPage = lazy(() => chunks.setPassword().then((m) => ({ default: m.SetPasswordPage })));
const ForgotPasswordPage = lazy(() => chunks.forgotPassword().then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => chunks.resetPassword().then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => chunks.dashboard().then((m) => ({ default: m.DashboardPage })));
const BookingsPage = lazy(() => chunks.bookings().then((m) => ({ default: m.BookingsPage })));
const BrandingSettingsPage = lazy(() => chunks.branding().then((m) => ({ default: m.BrandingSettingsPage })));
const ProfessionalsPage = lazy(() => chunks.professionals().then((m) => ({ default: m.ProfessionalsPage })));
const ServicesPage = lazy(() => chunks.services().then((m) => ({ default: m.ServicesPage })));
const LocationsPage = lazy(() => chunks.locations().then((m) => ({ default: m.LocationsPage })));
const PublicSiteSettingsPage = lazy(() =>
  chunks.publicSite().then((m) => ({ default: m.PublicSiteSettingsPage })),
);
const HoursPage = lazy(() => chunks.hours().then((m) => ({ default: m.HoursPage })));
const BlockedNumbersPage = lazy(() => chunks.blockedNumbers().then((m) => ({ default: m.BlockedNumbersPage })));
const SubscriptionPage = lazy(() => chunks.subscription().then((m) => ({ default: m.SubscriptionPage })));

const NAV_CHUNKS = [
  chunks.dashboard,
  chunks.bookings,
  chunks.branding,
  chunks.professionals,
  chunks.services,
  chunks.locations,
  chunks.publicSite,
  chunks.hours,
  chunks.subscription,
  chunks.blockedNumbers,
];

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { status, session } = useAuth();
  // R320: whether there's a session is only known once /cms/auth/me answers —
  // redirecting before that would bounce a signed-in user to the login page.
  if (status === "loading") return <RouteFallback />;
  return session ? children : <Navigate to="/login" replace />;
}

function RequireOwner({ children }: { children: React.ReactElement }) {
  const { role } = useAuth();
  return role === "owner" ? children : <Navigate to="/" replace />;
}

export function App() {
  const { session } = useAuth();
  const signedIn = session !== null;

  useEffect(() => {
    if (!signedIn) return;

    const warm = () => {
      for (const load of NAV_CHUNKS) void load().catch(() => undefined);
    };

    if (typeof requestIdleCallback === "function") {
      const handle = requestIdleCallback(warm);
      return () => cancelIdleCallback(handle);
    }
    const timer = setTimeout(warm, 1_000);
    return () => clearTimeout(timer);
  }, [signedIn]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/set-password/:tenantId/:token" element={<SetPasswordPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:tenantId/:token" element={<ResetPasswordPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/bookings"
            element={
              <RequireAuth>
                <BookingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/blocked-numbers"
            element={
              <RequireAuth>
                <RequireOwner>
                  <BlockedNumbersPage />
                </RequireOwner>
              </RequireAuth>
            }
          />
          <Route
            path="/settings/subscription"
            element={
              <RequireAuth>
                <RequireOwner>
                  <SubscriptionPage />
                </RequireOwner>
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
          {/* R150: branches are business structure */}
          <Route
            path="/locations"
            element={
              <RequireAuth>
                <RequireOwner>
                  <LocationsPage />
                </RequireOwner>
              </RequireAuth>
            }
          />
          {/* R170: the public site's title and description */}
          <Route
            path="/settings/public-site"
            element={
              <RequireAuth>
                <RequireOwner>
                  <PublicSiteSettingsPage />
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
