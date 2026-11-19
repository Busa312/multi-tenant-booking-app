import { PUBLIC_CMS_URL } from "astro:env/client";

/** The product's name, wherever the site says it. */
export const brandName = "Book-it";

export const cmsUrl = PUBLIC_CMS_URL;

/** R580: the platform's inbox, offered beside the contact form and in the footer. */
export const contactEmail = "contact@book-it.ge";

/** The business in the screenshots (the seed's "aura" tenant), as it would
    be addressed on this environment's domain. */
export const demoBusiness = (site: URL | undefined) => ({
  name: "Aura Beauty Studio",
  host: `aura.${(site?.hostname ?? "book-it.ge").replace(/^www\./, "")}`,
});
