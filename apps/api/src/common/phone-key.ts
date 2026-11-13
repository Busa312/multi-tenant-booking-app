import { toSmsNumber } from "../notifications/sms-number.js";

/**
 * One spelling per phone number, for comparing numbers people typed
 * differently: "598 55 05 94", "+995598550594" and "00995 598550594" are the
 * same phone and get the same key. International digits where the number can
 * be read as one (see toSmsNumber), bare digits otherwise. Empty when there
 * are no digits at all — nothing to compare.
 */
export function phoneKey(phoneNumber: string): string {
  return toSmsNumber(phoneNumber) ?? phoneNumber.replace(/\D/g, "");
}
