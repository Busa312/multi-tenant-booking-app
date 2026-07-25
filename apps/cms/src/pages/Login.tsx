import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@booking/api-client";
import { useAuth } from "../auth/AuthContext.js";
import { cmsApiClient } from "../lib/api.js";

const PUBLIC_SITE_BASE_DOMAIN = import.meta.env.VITE_PUBLIC_SITE_BASE_DOMAIN as string | undefined;

export function LoginPage() {
  const [subdomain, setSubdomain] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { accessToken } = await cmsApiClient.login({ subdomain, email, password });
      login(accessToken);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? "Invalid business, email, or password" : "Something went wrong");
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
          <div className="login-art-headline">The chair is booked. The rest runs itself.</div>
          <div className="login-art-sub">
            Bookings, your team, your services, and your public site — one calm place to run the salon.
          </div>
        </div>
      </div>

      <div className="login-form-wrap">
        <form className="login-form fade-up" onSubmit={handleSubmit}>
          <div className="login-form-brand">
            <span className="ms">content_cut</span>
            <span>Booking CMS</span>
          </div>
          <h1 className="login-title">Sign in to your studio</h1>
          <p className="login-subtitle">Enter your salon workspace to manage bookings.</p>

          <label className="field-label" htmlFor="subdomain">
            Salon workspace
          </label>
          <div className="input-group" style={{ marginBottom: "16px" }}>
            <input
              id="subdomain"
              type="text"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder="your-salon"
              required
            />
            {PUBLIC_SITE_BASE_DOMAIN && <span className="input-group-suffix">.{PUBLIC_SITE_BASE_DOMAIN}</span>}
          </div>

          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@salon.com"
            required
            style={{ marginBottom: "16px" }}
          />

          <div className="field-row">
            <label className="field-label" htmlFor="password" style={{ marginBottom: 0 }}>
              Password
            </label>
          </div>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            {submitting ? "Signing in…" : "Sign in"}
            <span className="ms" style={{ fontSize: "19px" }}>
              arrow_forward
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
