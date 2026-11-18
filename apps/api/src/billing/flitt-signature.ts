import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Flitt's request/response signature (docs.flitt.com/api/building-signature):
 * SHA-1, lowercase hex, of the secret key followed by every non-empty
 * parameter value, sorted by parameter name, joined with "|". `signature` and
 * the test-mode-only `response_signature_string` are never part of it. A value
 * of 0 is kept ("0"), only empty/absent ones are dropped.
 */
export function flittSignature(secret: string, params: Readonly<Record<string, unknown>>): string {
  const values = Object.keys(params)
    .filter((key) => key !== "signature" && key !== "response_signature_string")
    .sort()
    .map((key) => params[key])
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => (typeof value === "object" ? JSON.stringify(value) : String(value)));
  return createHash("sha1").update([secret, ...values].join("|")).digest("hex");
}

/** Whether `params.signature` is the one Flitt would make with our secret. */
export function verifyFlittSignature(secret: string, params: Readonly<Record<string, unknown>>): boolean {
  const given = params.signature;
  if (typeof given !== "string" || !/^[0-9a-f]{40}$/i.test(given)) return false;
  const expected = Buffer.from(flittSignature(secret, params), "hex");
  return timingSafeEqual(expected, Buffer.from(given.toLowerCase(), "hex"));
}
