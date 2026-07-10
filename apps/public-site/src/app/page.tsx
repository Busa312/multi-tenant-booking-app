import { getPublicApiClient } from "@/lib/api";

export const revalidate = 60; // ISR — system_design.md §12: SEO-relevant pages are not client-rendered

export default async function HomePage() {
  const api = getPublicApiClient();
  const [tenant, services] = await Promise.all([api.getTenant(), api.listServices()]);

  return (
    <main>
      <h1>{tenant.name}</h1>
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
