/**
 * A phone number as the CMS shows it, the same way whatever way it was typed:
 * a Georgian mobile as "555 14 80 04" (with or without +995 / 995 in front),
 * anything else as entered, trimmed. Display only — numbers are matched by
 * their canonical key on the server (R400), never by this.
 */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("995") ? digits.slice(3) : digits;
  if (/^5\d{8}$/.test(local)) {
    return `${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
  }
  return raw.trim();
}

/** The number for a tel: link — digits, with a leading + kept. */
export function telHref(raw: string): string {
  const trimmed = raw.trim();
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${trimmed.replace(/\D/g, "")}`;
}
