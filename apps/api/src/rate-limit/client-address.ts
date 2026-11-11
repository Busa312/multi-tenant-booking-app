import { timingSafeEqual } from "crypto";
import { isIP } from "net";
import type { FastifyRequest } from "fastify";

/** Set by the public site's server: the visitor it's calling on behalf of. */
export const VISITOR_IP_HEADER = "x-visitor-ip";
/** Proves the call really comes from the public site's server (PUBLIC_SITE_API_KEY). */
export const PUBLIC_SITE_KEY_HEADER = "x-public-site-key";

/**
 * R330: who to count a request against.
 *
 * Browser calls (the CMS) come through the platform's load balancer: Fastify's
 * `request.ip`, with `trustProxy` set to exactly that hop (TRUST_PROXY) — so
 * a client can't choose its own address by sending X-Forwarded-For.
 *
 * Public calls come from the public site's *server* on a visitor's behalf; its
 * own address would lump every visitor together. It names the visitor in
 * X-Visitor-IP, and that is believed only alongside the shared key — anyone
 * else sending the header is ignored.
 */
export function clientAddress(request: FastifyRequest, publicSiteKey: string | undefined): string {
  const claimed = single(request.headers[VISITOR_IP_HEADER]);
  const presented = single(request.headers[PUBLIC_SITE_KEY_HEADER]);
  if (claimed && isIP(claimed) && publicSiteKey && presented && sameSecret(presented, publicSiteKey)) {
    return claimed;
  }
  return request.ip || "unknown";
}

/**
 * TRUST_PROXY → Fastify's trustProxy: a hop count ("1" behind one load
 * balancer), or a comma-separated list of proxy addresses/CIDRs. Unset or
 * "false" trusts nothing (local development, where nothing proxies).
 * Never `true`: that would believe any X-Forwarded-For a client sends.
 */
export function parseTrustProxy(value: string | undefined): boolean | number | string {
  const trimmed = (value ?? "").trim();
  if (trimmed === "" || trimmed === "false" || trimmed === "0") return false;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  if (trimmed === "true") {
    throw new Error("TRUST_PROXY=true would trust any client's X-Forwarded-For; set a hop count or proxy addresses");
  }
  return trimmed;
}

const single = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

function sameSecret(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
