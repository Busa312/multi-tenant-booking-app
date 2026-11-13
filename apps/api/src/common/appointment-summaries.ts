import type { AppointmentSummary } from "@booking/shared-types";
import type { Prisma } from "../../generated/prisma/index.js";
import { loadBlockedKeys } from "../booking/blocked-phone.service.js";
import { loadFinishedVisits, noShowHistoryBefore } from "./no-show-history.js";
import { serializeAppointmentSummary, type PrismaAppointmentSummary } from "./serializers.js";

/**
 * Appointments as the CMS shows them: each with what this salon knows about
 * its customer — how their last visits went (R360) and whether the salon has
 * blocked the number (R380). Two lookups for the whole page, never one per
 * row, and both scoped to `tenantId`: nothing here is ever read from, or
 * shown to, another salon.
 */
export async function summarizeAppointments(
  tx: Prisma.TransactionClient,
  tenantId: string,
  appointments: PrismaAppointmentSummary[],
): Promise<AppointmentSummary[]> {
  const phones = appointments.map((appointment) => appointment.phoneNumber);
  const [visits, blocked] = await Promise.all([
    loadFinishedVisits(tx, tenantId, phones),
    loadBlockedKeys(tx, tenantId, phones),
  ]);
  return appointments.map((appointment) =>
    serializeAppointmentSummary(appointment, {
      noShowHistory: noShowHistoryBefore(visits.get(appointment.phoneKey), appointment.startAt),
      phoneBlocked: blocked.has(appointment.phoneKey),
    }),
  );
}
