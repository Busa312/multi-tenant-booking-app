import { headers } from "next/headers";
import { PublicApiClient } from "@booking/api-client";

/**
 * Server Components and server actions only. Forwards the incoming browser
 * request's Host header to the API as x-forwarded-host so HostTenantMiddleware
 * can resolve the tenant — a server-to-server fetch's own Host header would
 * otherwise be this app's, not the visitor's (system_design.md §4/§7). The
 * visitor's address goes along as x-forwarded-for for the same reason: the API
 * limits how fast one visitor can take slot holds (R250).
 */
export function getPublicApiClient(): PublicApiClient {
  const incoming = headers();
  const host = incoming.get("host") ?? "";
  const visitor = (incoming.get("x-forwarded-for") ?? incoming.get("x-real-ip") ?? "").split(",")[0]?.trim() ?? "";
  return new PublicApiClient({
    baseUrl: process.env.API_URL!,
    getExtraHeaders: () => ({ "x-forwarded-host": host, ...(visitor ? { "x-forwarded-for": visitor } : {}) }),
  });
}
