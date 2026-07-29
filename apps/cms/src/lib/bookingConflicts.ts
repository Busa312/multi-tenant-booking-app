import { ApiError } from "@booking/api-client";
import type { BookingConflict, BookingConflictResponse } from "@booking/shared-types";

/**
 * R60: the API refuses an unconfirmed booking with 409 + the conflicts it found.
 * Returns them when that's what happened, and null for every other failure —
 * a 409 the caller can't explain must surface as an error, not as a warning the
 * user could click straight past.
 */
export function conflictsFromError(err: unknown): BookingConflict[] | null {
  if (!(err instanceof ApiError) || err.status !== 409) {
    return null;
  }
  const body = err.body as Partial<BookingConflictResponse> | undefined;
  return body?.code === "booking_conflict" && Array.isArray(body.conflicts) ? body.conflicts : null;
}
