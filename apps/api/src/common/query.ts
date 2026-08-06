/**
 * Repeated values arrive on a single query key, comma-joined by the api-client
 * (`serviceIds=a,b`), so they reach a handler as one string however the DTO
 * types them. Fastify would also hand back a real array if the key were
 * repeated, hence both branches.
 */
export function parseIdList(value: string[] | string | undefined): string[] {
  const raw = Array.isArray(value) ? value : String(value ?? "").split(",");
  return raw.map((id) => id.trim()).filter(Boolean);
}
