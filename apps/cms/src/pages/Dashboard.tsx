import { useEffect, useState } from "react";
import type { Tenant } from "@booking/shared-types";
import { cmsApiClient } from "../lib/api.js";
import { useAuth } from "../auth/AuthContext.js";

export function DashboardPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const { logout } = useAuth();

  useEffect(() => {
    cmsApiClient.getTenant().then(setTenant);
  }, []);

  return (
    <div>
      <h1>{tenant?.name ?? "Loading…"}</h1>
      <p>Services, professionals, hours, and appointments management land here.</p>
      <button onClick={logout}>Sign out</button>
    </div>
  );
}
