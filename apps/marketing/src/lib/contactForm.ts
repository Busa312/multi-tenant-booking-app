import { API_URL } from "astro:env/server";

/**
 * R580: where the contact form posts — the API's POST /contact, which answers
 * with a redirect back to this site's thank-you or try-again page. A plain
 * HTML form, so the page ships no script. Builds without an API (CI) point at
 * production's, which only matters if someone submits from such a build.
 */
export const contactAction = new URL("/contact", API_URL ?? "https://api.book-it.ge").href;

/** The form's limits; the API checks the same (apps/api/src/contact/contact-form.ts). */
export const contactLimits = { name: 100, business: 150, phone: 40, email: 200, message: 2000 } as const;
