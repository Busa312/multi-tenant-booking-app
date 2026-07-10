import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";
import { LoginPage } from "./pages/Login.js";
import { DashboardPage } from "./pages/Dashboard.js";

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
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
    </Routes>
  );
}
