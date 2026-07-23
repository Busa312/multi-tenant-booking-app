import { headers } from "next/headers";
import { getPublicApiClient } from "@/lib/api";
import { getCachedTenant } from "@/lib/tenant-config";

export const revalidate = 60; // ISR — system_design.md §12: SEO-relevant pages are not client-rendered

export default async function HomePage() {
  const host = headers().get("host") ?? "";
  const [tenant, services] = await Promise.all([getCachedTenant(host), getPublicApiClient().listServices()]);

  return (
    <main>
      <h1 style={{ color: "var(--color-primary)" }}>{tenant.name}</h1>
      <ul>
        {services.map((service) => (
          <li key={service.id}>
            {service.name} — {service.durationMinutes} min — ${service.price}
          </li>
        ))}
      </ul>
    </main>
  );
}
