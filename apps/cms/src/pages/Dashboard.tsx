import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Tenant } from "@booking/shared-types";
import { cmsApiClient } from "../lib/api.js";
import { useAuth } from "../auth/AuthContext.js";
import { AppShell } from "../components/AppShell.js";

export function DashboardPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const { role } = useAuth();

  useEffect(() => {
    cmsApiClient.getTenant().then(setTenant);
  }, []);

  return (
    <AppShell
      title={tenant ? `Welcome back` : "Loading…"}
      subtitle={tenant ? tenant.name : undefined}
      tenantSubdomain={tenant?.subdomain}
    >
      <div className="fade-up">
        <div className="card" style={{ maxWidth: "560px" }}>
          <div className="eyebrow">Getting around</div>
          <p style={{ margin: "0 0 12px", color: "var(--ink-soft)", lineHeight: 1.6 }}>
            Services, professionals, hours, and appointment management land here as they're built out.
          </p>
          {role === "owner" && (
            <Link to="/settings/colors" className="btn btn-secondary" style={{ display: "inline-flex" }}>
              <span className="ms" style={{ fontSize: "19px", color: "var(--accent)" }}>
                palette
              </span>
              Edit public site colors
            </Link>
          )}
        </div>
      </div>
    </AppShell>
  );
}
