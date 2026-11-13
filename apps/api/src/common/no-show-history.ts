import type { NoShowHistory } from "@booking/shared-types";
import type { Prisma } from "../../generated/prisma/index.js";
import { phoneKey } from "./phone-key.js";

/**
 * R360: how a customer's recent visits went, so staff see a likely no-show
 * before the day starts.
 *
 * Derived, never stored: it is read from the phone's past appointments in this
 * tenant whose status a person has set to `completed` or `no_show` (R100).
 * Cancelled and still-booked appointments say nothing either way. RLS keeps it
 * inside the salon — one salon never learns of another's no-shows.
 */

/** How many of the customer's latest finished visits are looked at. */
export const NO_SHOW_HISTORY_VISITS = 3;

/** One appointment with a final status, as read for the history. */
export interface FinishedSegment {
  id: string;
  /** R200: segments of one customer visit share this; null = a staff-made booking, a visit of its own. */
  visitId: string | null;
  /** The customer's number in its canonical spelling (phone-key.ts). */
  phoneKey: string;
  status: string;
  startAt: Date;
}

export interface FinishedVisit {
  startAt: Date;
  /** The customer came to none of it. */
  missed: boolean;
}

/**
 * Collapses segments into visits, newest first, per phone key. A visit counts
 * once however many segments it has, and counts as missed only when every
 * segment was a no-show — turning up for part of it is turning up.
 */
export function finishedVisitsByPhone(segments: FinishedSegment[]): Map<string, FinishedVisit[]> {
  const visits = new Map<string, { phoneKey: string; startAt: Date; missed: boolean }>();
  for (const segment of segments) {
    const key = segment.visitId ?? segment.id;
    const missed = segment.status === "no_show";
    const visit = visits.get(key);
    if (!visit) {
      visits.set(key, { phoneKey: segment.phoneKey, startAt: segment.startAt, missed });
      continue;
    }
    visit.missed = visit.missed && missed;
    if (segment.startAt < visit.startAt) visit.startAt = segment.startAt;
  }

  const byPhone = new Map<string, FinishedVisit[]>();
  for (const { phoneKey: customer, startAt, missed } of visits.values()) {
    const list = byPhone.get(customer) ?? [];
    list.push({ startAt, missed });
    byPhone.set(customer, list);
  }
  for (const list of byPhone.values()) {
    list.sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
  }
  return byPhone;
}

/**
 * The customer's record as it stood before `before`: of their last few
 * finished visits, how many they missed. Null with no finished visit — a new
 * customer is never flagged.
 */
export function noShowHistoryBefore(visits: FinishedVisit[] | undefined, before: Date): NoShowHistory | null {
  const earlier = (visits ?? []).filter((visit) => visit.startAt < before).slice(0, NO_SHOW_HISTORY_VISITS);
  if (earlier.length === 0) {
    return null;
  }
  return { missed: earlier.filter((visit) => visit.missed).length, of: earlier.length };
}

/**
 * Every finished visit of these phones in the tenant — one query for the whole
 * page of results. Keyed by phone key (`phoneKey(number)`), so a customer is
 * one customer however they typed their number each time.
 */
export async function loadFinishedVisits(
  tx: Prisma.TransactionClient,
  tenantId: string,
  phoneNumbers: string[],
): Promise<Map<string, FinishedVisit[]>> {
  const keys = [...new Set(phoneNumbers.map(phoneKey).filter((key) => key !== ""))];
  if (keys.length === 0) {
    return new Map();
  }
  const segments = await tx.appointment.findMany({
    where: { tenantId, phoneKey: { in: keys }, status: { in: ["completed", "no_show"] } },
    select: { id: true, visitId: true, phoneKey: true, status: true, startAt: true },
  });
  return finishedVisitsByPhone(segments);
}
