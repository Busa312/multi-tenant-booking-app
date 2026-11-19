import type { Messages } from "../i18n";
import type { MarketingPlan } from "./plans";
import { brandName, contactEmail } from "./site";

// R560: schema.org data for search engines, made only from what the page
// itself says — its description, its plans and prices, its questions — so
// the two can't disagree. No ratings or reviews: there are none to cite.
export function structuredData(t: Messages, plans: MarketingPlan[], urls: { home: string; page: string }) {
  const organization = `${urls.home}#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organization,
        name: brandName,
        url: urls.home,
        logo: new URL("/logo.png", urls.home).href,
        email: contactEmail,
      },
      {
        "@type": "WebSite",
        "@id": `${urls.home}#website`,
        name: brandName,
        url: urls.home,
        inLanguage: t.htmlLang,
        publisher: { "@id": organization },
      },
      {
        "@type": "SoftwareApplication",
        name: brandName,
        url: urls.page,
        description: t.meta.description,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: t.htmlLang,
        publisher: { "@id": organization },
        offers: plans.map((plan) => ({
          "@type": "Offer",
          name: t.pricing.planNames[plan.id],
          price: plan.price.toFixed(2),
          priceCurrency: "GEL",
          url: `${urls.page}#pricing`,
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: plan.price.toFixed(2),
            priceCurrency: "GEL",
            unitCode: "MON",
            referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
          },
        })),
      },
      {
        "@type": "FAQPage",
        url: urls.page,
        inLanguage: t.htmlLang,
        mainEntity: t.faq.items.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
}

/** JSON for a `<script type="application/ld+json">`: `<` escaped so no text can close the tag. */
export const toJsonLd = (data: unknown): string => JSON.stringify(data).replace(/</g, "\\u003c");
