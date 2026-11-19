/**
 * R580: the marketing site's contact form, checked. Pure: no I/O. The form
 * already marks its fields required and caps their lengths, so anything that
 * fails here came from a stale page or a script — it isn't worth a field-by-
 * field message, only "couldn't send".
 */

export type ContactLocale = "ka" | "en" | "ru";

export interface ContactFormData {
  name: string;
  business: string;
  phone: string;
  email: string | null;
  message: string | null;
  locale: ContactLocale;
}

export type ParsedContactForm =
  | { kind: "valid"; data: ContactFormData }
  /** The honeypot was filled: a bot. Answered like a success, and dropped. */
  | { kind: "spam"; locale: ContactLocale }
  | { kind: "invalid"; locale: ContactLocale };

const LIMITS = { name: 100, business: 150, phone: 40, email: 200, message: 2000 } as const;
const PHONE = /^\+?[0-9 ()-]{6,40}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export function localeOf(value: unknown): ContactLocale {
  return value === "en" || value === "ru" ? value : "ka";
}

export function parseContactForm(body: unknown): ParsedContactForm {
  const fields = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const locale = localeOf(fields.locale);
  if (text(fields.website) !== "") return { kind: "spam", locale };

  const name = text(fields.name);
  const business = text(fields.business);
  const phone = text(fields.phone);
  const email = text(fields.email);
  const message = text(fields.message);
  const fits =
    name.length >= 1 && name.length <= LIMITS.name &&
    business.length >= 1 && business.length <= LIMITS.business &&
    PHONE.test(phone) &&
    (email === "" || (email.length <= LIMITS.email && EMAIL.test(email))) &&
    message.length <= LIMITS.message;
  if (!fits) return { kind: "invalid", locale };

  return { kind: "valid", data: { name, business, phone, email: email || null, message: message || null, locale } };
}

/** Where the visitor goes next: the marketing site's thank-you or try-again page, in their language. */
export function resultUrl(marketingUrl: string, locale: ContactLocale, result: "thanks" | "sorry"): string {
  const prefix = locale === "ka" ? "" : `/${locale}`;
  return new URL(`${prefix}/contact/${result}/`, marketingUrl).href;
}
