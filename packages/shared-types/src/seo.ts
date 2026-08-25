// Tenant search-engine settings (Tenant.config_json.seo / .business) + the
// validation and fallback rules shared by apps/api (server-side validation),
// apps/cms (inline form validation + the search-result preview) and
// apps/public-site (render-time re-validation before anything reaches <head>).
//
// The *resolvers* below matter as much as the validators: the CMS preview and
// the public site's real <head> must apply the identical fallback chain, or the
// preview becomes a lie the first time either side is edited alone.

import type { Tenant, TenantConfig } from "./entities";

export interface TenantSeo {
  /** Overrides the generated `${name} — Book online`. */
  title?: string;
  /** The meta description. Falls back to `copy.tagline`, then a generated line. */
  description?: string;
  /** Absolute https URL. Overrides the auto-generated share image. */
  ogImageUrl?: string;
  /**
   * Tenant's explicit "keep me out of search". One-directional on purpose: a
   * tenant may always hide, but may never force an unready site to be indexed
   * — see `isIndexable`.
   */
  noindex?: boolean;
}

/**
 * Factual business details. A sibling of `seo` rather than a member of it
 * because this is not search-engine-specific — it is the salon's real address
 * and phone, which booking confirmations and a contact section will want too.
 */
export interface TenantBusinessInfo {
  streetAddress?: string;
  city?: string;
  /** State / region / province. */
  region?: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2, e.g. "GE". */
  country?: string;
  telephone?: string;
  latitude?: number;
  longitude?: number;
}

// Google truncates a title around 60 characters and a description around 155-160;
// these are the caps the CMS counts down from and the API enforces. Deliberately
// generous rather than exact — over-length text is a quality problem, not a
// correctness one, so the limit exists to stop abuse, not to police copywriting.
export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 200;

/**
 * `<` is rejected outright in every tenant-authored SEO string.
 *
 * These values land in `<meta content="...">` and inside a
 * `<script type="application/ld+json">` data block. The JSON-LD serializer
 * escapes `<` on the way out, but refusing it at the door as well means a
 * malformed row can never depend on that one escape being correct — the same
 * validate-on-write-*and*-on-read posture `isValidColor` has.
 *
 * Accepts `unknown` for the reason documented on isValidColor: these values
 * trace back to an HTTP JSON body with no runtime schema validation, so a
 * number/null/array must return false rather than throw.
 */
export function isValidSeoString(value: unknown, maxLength: number): value is string {
  if (typeof value !== "string") {
    return false;
  }
  if (value.length > maxLength) {
    return false;
  }
  return !value.includes("<");
}

// Matched by regex rather than by `new URL()`: this package compiles with
// `lib: ["ES2022"]` and no DOM/Node types, and it is consumed by the API, the
// CMS and the public site alike — pulling in a lib just for the URL global
// would leak environment-specific types into all three. The character
// exclusions are the point anyway: this value ends up inside an HTML attribute,
// so quotes, angle brackets and whitespace have no business in it.
const HTTPS_URL_RE = /^https:\/\/[^\s<>"'`]+$/i;

/**
 * Absolute https URL. http is rejected rather than silently upgraded: several
 * social scrapers drop non-https images outright, and an http image on an https
 * page is a mixed-content warning.
 */
export function isValidHttpsUrl(value: unknown): value is string {
  return typeof value === "string" && HTTPS_URL_RE.test(value);
}

// Exactly 0 is rejected along with out-of-range values: (0, 0) is a point in the
// Gulf of Guinea and is what an empty number input produces, so it is far more
// likely to be "unset" than a real salon.
export function isValidLatitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value !== 0 && value >= -90 && value <= 90;
}

export function isValidLongitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value !== 0 && value >= -180 && value <= 180;
}

type SeoSource = Pick<Tenant, "name"> & { configJson: TenantConfig };

/** What the `<title>` and `og:title` say. */
export function resolveSeoTitle(tenant: SeoSource): string {
  const configured = tenant.configJson.seo?.title;
  if (isValidSeoString(configured, SEO_TITLE_MAX) && configured.trim()) {
    return configured.trim();
  }
  return `${tenant.name} — Book online`;
}

/**
 * The meta description, falling back to the tagline before a generated line.
 * `copy.tagline` is on-page marketing copy rather than a meta description, but
 * a tenant who has written one has already said the thing worth saying — asking
 * them to type it twice would just produce two stale strings.
 */
export function resolveSeoDescription(tenant: SeoSource): string {
  const configured = tenant.configJson.seo?.description;
  if (isValidSeoString(configured, SEO_DESCRIPTION_MAX) && configured.trim()) {
    return configured.trim();
  }
  const tagline = tenant.configJson.copy?.tagline;
  if (isValidSeoString(tagline, SEO_DESCRIPTION_MAX) && tagline.trim()) {
    return tagline.trim();
  }
  return `Book an appointment with ${tenant.name} online.`;
}

/**
 * Whether search engines should index this tenant at all.
 *
 * Computed rather than stored, so a tenant who signed up and abandoned setup
 * doesn't get a near-empty page indexed under their brand name. The tenant's
 * own `noindex` can only ever *hide* — nobody can force an unready site into
 * the index, which is the direction that would be abusable.
 *
 * `hasContent` is supplied by the caller because "has at least one active
 * service" needs a query the public site already makes and this module
 * shouldn't.
 */
export function isIndexable(tenant: SeoSource, hasActiveServices: boolean): boolean {
  if (tenant.configJson.seo?.noindex === true) {
    return false;
  }
  // `||` not `??`: a description saved as "" must fall through to the tagline.
  // `??` only skips null/undefined, so an empty string would both suppress the
  // tagline and report the tenant as unready.
  const hasDescription = Boolean(tenant.configJson.seo?.description || tenant.configJson.copy?.tagline);
  return hasDescription || hasActiveServices;
}
