import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from "@booking/shared-types";

/**
 * R310: the API's password rules, checked before the round trip. Returns the
 * message key for the first rule broken, or null when the password is fine.
 */
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "setPassword.errTooShort";
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return "setPassword.errTooLong";
  if (password !== confirm) return "setPassword.errMismatch";
  return null;
}
