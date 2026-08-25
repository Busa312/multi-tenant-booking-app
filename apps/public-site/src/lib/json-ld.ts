import type { Service, Tenant } from "@booking/shared-types";
import {
  SEO_DESCRIPTION_MAX,
  isValidHttpsUrl,
  isValidLatitude,
  isValidLongitude,
  isValidSeoString,
  resolveSeoDescription,
} from "@booking/shared-types";

/**
 * schema.org structured data for the tenant's landing page.
 *
 * Two rules govern everything here:
 *
 * 1. **Whitelist, never spread.** Each field is read by name and type-checked
 *    before it is emitted, so a config_json row holding
 *    `{"telephone": {"$ref": …}}` produces no `telephone` key rather than a
 *    garbage object. This is the same read-time re-validation resolveTenantColors
 *    does before interpolating into <style>.
 * 2. **Escape `<` on the way out.** See jsonLdScriptContent.
 */

// HairSalon is a subtype of LocalBusiness. It is a better match than the generic
// type for the salons this platform serves, and consumers that only understand
// LocalBusiness still resolve it through the schema.org hierarchy.
const BUSINESS_TYPE = "HairSalon";

/** A field is emitted only if it survives this. */
const seoText = (value: unknown): string | undefined =>
  isValidSeoString(value, SEO_DESCRIPTION_MAX) && value.trim() ? value.trim() : undefined;

function buildAddress(tenant: Tenant): Record<string, string> | null {
  const business = tenant.configJson.business ?? {};
  const address: Record<string, string> = { "@type": "PostalAddress" };

  const streetAddress = seoText(business.streetAddress);
  const addressLocality = seoText(business.city);
  const addressRegion = seoText(business.region);
  const postalCode = seoText(business.postalCode);
  const addressCountry = seoText(business.country);

  if (streetAddress) address.streetAddress = streetAddress;
  if (addressLocality) address.addressLocality = addressLocality;
  if (addressRegion) address.addressRegion = addressRegion;
  if (postalCode) address.postalCode = postalCode;
  if (addressCountry) address.addressCountry = addressCountry;

  // "@type" alone is not an address. Emitting an empty PostalAddress is worse
  // than emitting none — it tells Google the business has an address shaped
  // like nothing.
  return Object.keys(address).length > 1 ? address : null;
}

function buildGeo(tenant: Tenant): Record<string, unknown> | null {
  const { latitude, longitude } = tenant.configJson.business ?? {};
  // Both or neither — a lone coordinate locates nothing. isValidLatitude also
  // rejects exactly 0, which is what an empty number input produces.
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    return null;
  }
  return { "@type": "GeoCoordinates", latitude, longitude };
}

/**
 * schema.org's priceRange is a coarse indicator ("$$", "10-50 GEL"), and asking
 * a tenant to type one produces free text nobody can parse. The active service
 * prices are already the real answer, so it is derived.
 */
function buildPriceRange(services: readonly Service[]): string | undefined {
  const prices = services.map((service) => Number(service.price)).filter((price) => Number.isFinite(price) && price > 0);
  if (prices.length === 0) {
    return undefined;
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  // GEL, matching the platform-wide currency the price strings are quoted in.
  return min === max ? `${min} GEL` : `${min}–${max} GEL`;
}

function buildOffers(services: readonly Service[]): Record<string, unknown>[] {
  return services
    .map((service) => {
      const name = seoText(service.name);
      if (!name) {
        return null;
      }
      const offer: Record<string, unknown> = {
        "@type": "Offer",
        itemOffered: { "@type": "Service", name },
      };
      const price = Number(service.price);
      if (Number.isFinite(price) && price > 0) {
        offer.price = service.price;
        offer.priceCurrency = "GEL";
      }
      return offer;
    })
    .filter((offer): offer is Record<string, unknown> => offer !== null);
}

export function buildLocalBusinessJsonLd(
  tenant: Tenant,
  origin: string,
  services: readonly Service[],
  ogImageUrl: string | null,
): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": BUSINESS_TYPE,
    // @id anchors the entity to a stable URL so repeat crawls reconcile to one
    // business rather than accumulating duplicates.
    "@id": origin,
    url: origin,
    // Not run through seoText: the name is a required column with no fallback,
    // and jsonLdScriptContent escapes `<` on the way out regardless. Filtering
    // it here and then emitting the raw value anyway would only look like a check.
    name: tenant.name,
    description: resolveSeoDescription(tenant),
  };

  const address = buildAddress(tenant);
  if (address) jsonLd.address = address;

  const geo = buildGeo(tenant);
  if (geo) jsonLd.geo = geo;

  const telephone = seoText(tenant.configJson.business?.telephone);
  if (telephone) jsonLd.telephone = telephone;

  if (isValidHttpsUrl(ogImageUrl)) jsonLd.image = ogImageUrl;

  const logo = tenant.configJson.logoUrl;
  if (isValidHttpsUrl(logo)) jsonLd.logo = logo;

  const priceRange = buildPriceRange(services);
  if (priceRange) jsonLd.priceRange = priceRange;

  const offers = buildOffers(services);
  if (offers.length > 0) jsonLd.makesOffer = offers;

  // Deliberately absent: openingHoursSpecification. Business hours are not
  // exposed on any public endpoint, and the CMS's business-hours controller is
  // the one write path that never triggers revalidation — so publishing them
  // would mean publishing hours that are permanently stale, which is worse than
  // publishing none.

  return jsonLd;
}

/**
 * Serialises for embedding in `<script type="application/ld+json">`.
 *
 * Escaping `<` is necessary and sufficient. JSON.stringify never emits a bare
 * `<` outside a string literal, and `<` is valid JSON — so the output
 * still parses as JSON-LD while `</script`, `<script` and `<!--` all become
 * inert to the HTML tokenizer, which is the breakout this prevents.
 *
 * Do NOT HTML-entity-escape instead: entities are not decoded inside a script
 * data block, so `&lt;` would silently corrupt the JSON rather than protect it.
 * U+2028/2029 need no handling either — this is a data block, not executed JS.
 */
export function jsonLdScriptContent(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
