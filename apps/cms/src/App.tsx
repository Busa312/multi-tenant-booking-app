import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";
import { LoginPage } from "./pages/Login.js";
import { SetPasswordPage } from "./pages/SetPassword.js";
import { DashboardPage } from "./pages/Dashboard.js";
import { BrandingSettingsPage } from "./pages/BrandingSettings.js";
import { ProfessionalsPage } from "./pages/Professionals.js";
import { ServicesPage } from "./pages/Services.js";
import { HoursPage } from "./pages/Hours.js";

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
  return (
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
  );
}
