/**
 * A phone number as SMS gateways want it: international digits, no "+" or
 * "00". Customers type numbers however they like ("555 12 34 56",
 * "+995 555-123-456"), so a 9-digit Georgian mobile (5xx…) gets the 995
 * country code; anything else must already carry one. Returns null when the
 * number can't be dialled, so the caller doesn't pay for a send that fails.
 */
export function toSmsNumber(phoneNumber: string): string | null {
  let digits = phoneNumber.replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (digits.length === 9 && digits.startsWith("5")) {
    return `995${digits}`;
  }
  // E.164 allows at most 15 digits; below 11 there's no room for a country code
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

/** For logs: enough to tell numbers apart, not enough to be personal data. */
export const maskSmsNumber = (number: string): string => `…${number.slice(-3)}`;
