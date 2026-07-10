import { headers } from "next/headers";
import { PublicApiClient } from "@booking/api-client";

/**
 * Server Components only. Forwards the incoming browser request's Host
 * header to the API as x-forwarded-host so HostTenantMiddleware can resolve
 * the tenant — a server-to-server fetch's own Host header would otherwise be
 * this app's, not the visitor's (system_design.md §4/§7).
 */
export function getPublicApiClient(): PublicApiClient {
  const host = headers().get("host") ?? "";
  return new PublicApiClient({
    baseUrl: process.env.API_URL!,
    getExtraHeaders: () => ({ "x-forwarded-host": host }),
  });
}
