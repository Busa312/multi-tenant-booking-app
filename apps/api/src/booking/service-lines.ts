import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/index.js";

/**
 * Resolving a requested list of services into the lines an appointment is made
 * of — what each one costs and how long it takes.
 *
 * This lives in its own module rather than on either service because *both*
 * need it and BookingService already depends on AvailabilityService: the slot
 * picker and the write path must agree on how long a booking is, and the only
 * way to guarantee that is for them to compute it with the same function.
 * Anything else agrees by coincidence and drifts.
 */

/** A line as it will be written, or as availability should measure it. */
export interface ResolvedServiceLine {
  serviceId: string;
  name: string;
  durationMinutes: number;
  price: Prisma.Decimal;
  position: number;
}

/** The snapshot fields carried by a line already stored on an appointment. */
export interface ExistingServiceLine {
  serviceId: string;
  durationMinutes: number;
  price: Prisma.Decimal;
}

/** Total wall-clock length of a booking made of these lines. */
export const totalDurationMinutes = (lines: readonly ResolvedServiceLine[]): number =>
  lines.reduce((total, line) => total + line.durationMinutes, 0);

/**
 * R40: summed as Decimal, never through Number — `10.10 + 20.20` in floating
 * point is 30.299999999999997, and this figure is money on an invoice.
 */
export const totalPrice = (lines: readonly ResolvedServiceLine[]): Prisma.Decimal =>
  lines.reduce((total, line) => total.plus(line.price), new Prisma.Decimal(0));

/**
 * Rejects a service list that can't be booked, before anything reads the database.
 * Separate from `resolveServiceLines` so availability can refuse a malformed
 * query without opening a transaction.
 */
export function validateServiceIds(serviceIds: readonly string[]): void {
  if (serviceIds.length === 0) {
    throw new BadRequestException("at least one serviceId is required");
  }
  // Booking the same service twice in one appointment isn't offered yet — it
  // would need quantity semantics everywhere an appointment is read. Rejected
  // rather than deduplicated so the caller learns their request wasn't taken at
  // face value. `/public/availability` splits a comma-joined query param
  // straight into this, so the list is untrusted.
  if (new Set(serviceIds).size !== serviceIds.length) {
    throw new BadRequestException("a service can only be booked once per appointment");
  }
}

/**
 * The lines for `serviceIds`, in the order given.
 *
 * `existing` is the appointment's current lines when one is being edited. A
 * service that is already on it keeps the duration and price it was booked at:
 * adding a beard trim to last month's haircut must not re-quote the haircut
 * (R40). Only genuinely new services are priced at today's values — and those,
 * being new bookings, must be active (R120), while a service already on the
 * appointment may stay even if it has since been deactivated, for the same
 * reason a deactivated professional keeps the bookings already on their
 * calendar.
 */
export async function resolveServiceLines(
  tx: Prisma.TransactionClient,
  tenantId: string,
  serviceIds: readonly string[],
  existing: readonly ExistingServiceLine[] = [],
): Promise<ResolvedServiceLine[]> {
  validateServiceIds(serviceIds);

  const services = await tx.service.findMany({
    where: { tenantId, id: { in: [...serviceIds] } },
    select: { id: true, name: true, durationMinutes: true, price: true, isActive: true },
  });
  const byId = new Map(services.map((service) => [service.id, service]));
  const keptById = new Map(existing.map((line) => [line.serviceId, line]));

  // Indexed by the *requested* ids rather than built by mapping the query
  // result: `IN` neither preserves list order nor guarantees one row per entry.
  return serviceIds.map((serviceId, position) => {
    const service = byId.get(serviceId);
    if (!service) {
      throw new NotFoundException("Service not found");
    }
    const kept = keptById.get(serviceId);
    if (!kept && !service.isActive) {
      throw new BadRequestException(`"${service.name}" is deactivated and can't take new bookings`);
    }
    return {
      serviceId,
      name: service.name,
      durationMinutes: kept?.durationMinutes ?? service.durationMinutes,
      price: kept?.price ?? service.price,
      position,
    };
  });
}
