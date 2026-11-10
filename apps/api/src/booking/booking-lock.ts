import type { Prisma } from "../../generated/prisma/index.js";

/**
 * R260: serializes every booking write for one tenant's local day.
 *
 * Availability is computed (business hours minus appointments, time off and
 * holds), not reserved, so "check, then insert" at READ COMMITTED lets two
 * requests that arrive together both see a free calendar and both write. Taking
 * this lock *before* the check makes the second request wait until the first
 * commits; its check then sees the first one's rows.
 *
 * Transaction-scoped (`_xact_`): released on commit or rollback, so nothing can
 * leak it. Per day rather than per professional because an "any available" plan
 * can land on anyone — and at salon volumes one day's writes queueing for a few
 * milliseconds is invisible. Not an exclusion constraint: R60 lets staff overlap
 * appointments on purpose, and this still lets them (override skips the check,
 * not the lock).
 *
 * One lock per transaction, so two writers can't deadlock on each other.
 */
export async function lockBookingDay(tx: Prisma.TransactionClient, tenantId: string, date: string): Promise<void> {
  const key = `booking:${tenantId}:${date}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
