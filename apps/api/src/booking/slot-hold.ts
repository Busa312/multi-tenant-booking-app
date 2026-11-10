// R250: how long a picked time is held, and the limits that stop anyone from
// freezing a calendar by clicking through times. Hitting a limit only means no
// hold — the customer can still book, and the booking re-checks (R260).

export const HOLD_MINUTES = 10;

/** Holds one visitor (by IP) may take per window — generous for someone deciding. */
export const HOLD_MAX_PER_VISITOR = 20;
export const HOLD_VISITOR_WINDOW_SECONDS = 10 * 60;

/** Live holds one tenant may have at once, whoever took them. */
export const HOLD_MAX_LIVE_PER_TENANT = 40;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A hold id from the browser, or null. Anything that isn't a UUID is treated as
 * "no hold" rather than an error: the column is `uuid`, so passing garbage to
 * Postgres would surface as a 500, and a stale or mangled id should never stop
 * a customer from booking a time that is still free.
 */
export function parseHoldId(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value.trim()) ? value.trim().toLowerCase() : null;
}
