import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "@booking/api-client";
import { useAuth } from "../auth/AuthContext.js";
import { cmsApiClient } from "../lib/api.js";

// Public route (no RequireAuth) — reached from the link an owner copies out
// of the "Invite to CMS" flow (R50). tenantId travels in the URL alongside
// the token; see apps/api/src/auth/auth.service.ts's setPassword for why.
export function SetPasswordPage() {
  const { tenantId, token } = useParams<{ tenantId: string; token: string }>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (!tenantId || !token) {
      setError("This link is invalid");
      return;
    }

    setSubmitting(true);
    try {
      const { accessToken } = await cmsApiClient.setPassword({ tenantId, token, password });
      login(accessToken);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? "This link is invalid or has expired" : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-art">
        <div className="login-art-brand">
          <span className="ms">content_cut</span>
          <span>Booking CMS</span>
        </div>
        <div className="login-art-copy">
          <div className="login-art-headline">Welcome to the team.</div>
          <div className="login-art-sub">Set a password to finish setting up your CMS login.</div>
        </div>
      </div>

      <div className="login-form-wrap">
        <form className="login-form fade-up" onSubmit={handleSubmit}>
          <div className="login-form-brand">
            <span className="ms">content_cut</span>
            <span>Booking CMS</span>
          </div>
          <h1 className="login-title">Set your password</h1>
          <p className="login-subtitle">Choose a password to access your CMS account.</p>

          <label className="field-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{ marginBottom: "16px" }}
          />

          <label className="field-label" htmlFor="confirm">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            style={{ marginBottom: "22px" }}
          />

          {error && (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
            {submitting ? "Setting password…" : "Set password & sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
