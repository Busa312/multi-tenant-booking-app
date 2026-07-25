import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

interface NavItem {
  to: string;
  icon: string;
  label: string;
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  tenantSubdomain?: string;
  children: ReactNode;
}

// Nav only lists routes that actually exist — no placeholder links to
// not-yet-built pages (Bookings/Professionals/Services have API endpoints
// but no CMS UI yet).
export function AppShell({ title, subtitle, tenantSubdomain, children }: AppShellProps) {
  const { role, logout } = useAuth();
  const location = useLocation();

  const navItems: NavItem[] = [
    { to: "/", icon: "space_dashboard", label: "Dashboard" },
    ...(role === "owner" ? [{ to: "/settings/colors", icon: "palette", label: "Public site colors" }] : []),
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="ms">content_cut</span>
          <span className="side-brandtext">Booking CMS</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebar-nav-item${location.pathname === item.to ? " active" : ""}`}
            >
              <span className="ms">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">
            <span className="ms" style={{ fontSize: "18px" }}>
              person
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-foot-name">{role === "owner" ? "Owner" : "Professional"}</div>
            <button
              onClick={logout}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "var(--ink-soft)",
                fontSize: "11.5px",
                textDecoration: "underline",
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div style={{ minWidth: 0 }}>
            <div className="topbar-title">{title}</div>
            {subtitle && <div className="topbar-sub">{subtitle}</div>}
          </div>
          {tenantSubdomain && (
            <div className="topbar-tenant">
              <span className="ms">storefront</span>
              <span style={{ fontSize: "12.5px", fontWeight: 600 }}>{tenantSubdomain}</span>
            </div>
          )}
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
