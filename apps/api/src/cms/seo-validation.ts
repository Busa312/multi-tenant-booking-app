import { BadRequestException } from "@nestjs/common";
import type { TenantBusinessInfo, TenantSeo } from "@booking/shared-types";

// Mirrors the validators in packages/shared-types/src/seo.ts. Duplicated rather
// than imported for the same reason color-validation.ts is: @booking/shared-types
// ships raw TypeScript ESM with no build step, and apps/api's compiled
// dist/main.js is run by plain `node`, which can't execute that source. Every
// other reference to @booking/shared-types from here is `import type` only.
//
// Keep the rules in sync by hand — seo-validation.spec.ts pins them.

const SEO_TITLE_MAX = 70;
const SEO_DESCRIPTION_MAX = 200;

const HTTPS_URL_RE = /^https:\/\/[^\s<>"'`]+$/i;

// Accepts `unknown` rather than `string`: these values come straight off an
// unvalidated HTTP JSON body, so a number/null/array must return false here
// instead of throwing and turning a 400 into a 500.
function isValidSeoString(value: unknown, maxLength: number): value is string {
  if (typeof value !== "string") {
    return false;
  }
  if (value.length > maxLength) {
    return false;
  }
  // `<` is refused at the door as well as escaped on the way out (the public
  // site's json-ld serializer). Two layers, so a malformed row can never depend
  // on either one alone being correct.
  return !value.includes("<");
}

function isValidHttpsUrl(value: unknown): value is string {
  return typeof value === "string" && HTTPS_URL_RE.test(value);
}

// Exactly 0 is rejected along with out-of-range values: (0, 0) is a point in the
// Gulf of Guinea and is what an empty number input submits, so it means "unset"
// far more often than it means a real salon.
function isValidLatitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value !== 0 && value >= -90 && value <= 90;
}

function isValidLongitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value !== 0 && value >= -180 && value <= 180;
}

/** An empty string clears a field; anything else must pass its rule. */
const isClear = (value: unknown): boolean => value === undefined || value === null || value === "";

/**
 * Validates and normalises the `seo` sub-object. Returns the value to store —
 * cleared fields are dropped rather than stored as empty strings, so the
 * public site's fallback chain sees "absent" and resolves a real default.
 */
export function validateSeo(value: unknown): TenantSeo {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("seo must be an object");
  }
  const input = value as Record<string, unknown>;
  const seo: TenantSeo = {};

  if (!isClear(input.title)) {
    if (!isValidSeoString(input.title, SEO_TITLE_MAX)) {
      throw new BadRequestException(`title must be plain text of at most ${SEO_TITLE_MAX} characters`);
    }
    seo.title = input.title.trim();
  }

  if (!isClear(input.description)) {
    if (!isValidSeoString(input.description, SEO_DESCRIPTION_MAX)) {
      throw new BadRequestException(`description must be plain text of at most ${SEO_DESCRIPTION_MAX} characters`);
    }
    seo.description = input.description.trim();
  }

  if (!isClear(input.ogImageUrl)) {
    if (!isValidHttpsUrl(input.ogImageUrl)) {
      throw new BadRequestException("ogImageUrl must be an absolute https URL");
    }
    seo.ogImageUrl = input.ogImageUrl;
  }

  if (input.noindex !== undefined) {
    if (typeof input.noindex !== "boolean") {
      throw new BadRequestException("noindex must be a boolean");
    }
    // Only stored when true. A stored `false` reads as "this tenant insists on
    // being indexed", which isn't a thing they get to say — indexability is
    // computed, and their flag can only ever hide.
    if (input.noindex) {
      seo.noindex = true;
    }
  }

  return seo;
}

/** Validates and normalises the `business` sub-object. */
export function validateBusinessInfo(value: unknown): TenantBusinessInfo {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("business must be an object");
  }
  const input = value as Record<string, unknown>;
  const business: TenantBusinessInfo = {};

  const textFields = ["streetAddress", "city", "region", "postalCode", "country", "telephone"] as const;
  for (const field of textFields) {
    if (isClear(input[field])) {
      continue;
    }
    if (!isValidSeoString(input[field], SEO_TITLE_MAX)) {
      throw new BadRequestException(`${field} must be plain text of at most ${SEO_TITLE_MAX} characters`);
    }
    business[field] = (input[field] as string).trim();
  }

  // Both or neither — a lone coordinate locates nothing, and half a pair in the
  // database would just have to be discarded at render time anyway.
  const hasLat = !isClear(input.latitude);
  const hasLng = !isClear(input.longitude);
  if (hasLat !== hasLng) {
    throw new BadRequestException("latitude and longitude must be provided together");
  }
  if (hasLat && hasLng) {
    if (!isValidLatitude(input.latitude)) {
      throw new BadRequestException("latitude must be a number between -90 and 90");
    }
    if (!isValidLongitude(input.longitude)) {
      throw new BadRequestException("longitude must be a number between -180 and 180");
    }
    business.latitude = input.latitude;
    business.longitude = input.longitude;
  }

  return business;
}
