import { headers } from "next/headers";
import { PublicApiClient } from "@booking/api-client";

/**
 * Server Components and server actions only. Forwards the incoming browser
 * request's Host header to the API as x-forwarded-host so HostTenantMiddleware
 * can resolve the tenant — a server-to-server fetch's own Host header would
 * otherwise be this app's, not the visitor's (system_design.md §4/§7). The
 * visitor's address goes along too, vouched for by a shared key: the API's
 * rate limits count per visitor (R330), not per this server.
 */
export function getPublicApiClient(): PublicApiClient {
  const incoming = headers();
  const host = incoming.get("host") ?? "";
  // The visitor's address as this app's own host/proxy recorded it (the
  // first X-Forwarded-For hop, set by the platform — not by the visitor).
  const visitor = (incoming.get("x-forwarded-for") ?? incoming.get("x-real-ip") ?? "").split(",")[0]?.trim() ?? "";
  const key = process.env.PUBLIC_SITE_API_KEY;
  return new PublicApiClient({
    baseUrl: process.env.API_URL!,
    getExtraHeaders: () => ({
      "x-forwarded-host": host,
      // R330: the API counts limits per visitor, and believes this address
      // only alongside the shared key (apps/api rate-limit/client-address.ts).
      ...(visitor && key ? { "x-visitor-ip": visitor, "x-public-site-key": key } : {}),
    }),
  });
}
