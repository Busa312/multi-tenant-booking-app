import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";
import { LoginPage } from "./pages/Login.js";
import { DashboardPage } from "./pages/Dashboard.js";
import { BrandingSettingsPage } from "./pages/BrandingSettings.js";

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
    </Routes>
  );
}
