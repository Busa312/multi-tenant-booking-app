/**
 * R630: where a visit takes place, and what a customer's address must look
 * like. Pure: every write path (customer bookings and holds, staff bookings)
 * runs its input through here, so the rules are the same everywhere.
 */
import { BadRequestException } from "@nestjs/common";
import type { ServicePlace, VisitPlace } from "@booking/shared-types";

export const ADDRESS_MAX = 200;
export const ADDRESS_DETAILS_MAX = 100;
export const ADDRESS_NOTE_MAX = 300;

const MINUTE = 60_000;

/** A request's place: omitted = at the business; anything else unknown is refused. */
export function parseVisitPlace(value: unknown): VisitPlace {
  if (value === undefined || value === null || value === "" || value === "business") return "business";
  if (value === "customer") return "customer";
  throw new BadRequestException("place must be business or customer");
}

export function parseServicePlace(value: unknown): ServicePlace {
  if (value === "business" || value === "customer" || value === "either") return value;
  throw new BadRequestException("place must be business, customer or either");
}

/** Whether a service set up for `servicePlace` can be booked at `place`. Unset reads as the column's default. */
export function offeredAt(servicePlace: string | undefined, place: VisitPlace): boolean {
  const offered = servicePlace ?? "business";
  return offered === "either" || offered === place;
}

/**
 * One visit, one place: every service must be offered there. Services an
 * existing booking already has (`keptServiceIds`) stay, even if the service
 * has since moved place — the booking was made under the old setting.
 */
export function assertOfferedAt(
  lines: readonly { serviceId: string; name: string; place?: string }[],
  place: VisitPlace,
  keptServiceIds: ReadonlySet<string> = new Set(),
): void {
  const misplaced = lines.find((line) => !keptServiceIds.has(line.serviceId) && !offeredAt(line.place, place));
  if (misplaced) {
    throw new BadRequestException(
      place === "customer"
        ? `"${misplaced.name}" isn't offered at the customer's address`
        : `"${misplaced.name}" is only offered at the customer's address`,
    );
  }
}

export interface CustomerAddress {
  address: string;
  details: string | null;
  note: string | null;
}

export interface CustomerAddressInput {
  customerAddress?: unknown;
  customerAddressDetails?: unknown;
  customerAddressNote?: unknown;
}

const optionalText = (value: unknown, field: string, max: number): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new BadRequestException(`${field} must be text`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BadRequestException(`${field} can be at most ${max} characters`);
  return trimmed || null;
};

/** The address a home visit needs; null at the business, where sending one is refused. */
export function parseCustomerAddress(place: VisitPlace, input: CustomerAddressInput): CustomerAddress | null {
  const address = optionalText(input.customerAddress, "customerAddress", ADDRESS_MAX);
  const details = optionalText(input.customerAddressDetails, "customerAddressDetails", ADDRESS_DETAILS_MAX);
  const note = optionalText(input.customerAddressNote, "customerAddressNote", ADDRESS_NOTE_MAX);
  if (place === "business") {
    if (address || details || note) throw new BadRequestException("an address is only taken for a visit at the customer's address");
    return null;
  }
  if (!address) throw new BadRequestException("customerAddress is required for a visit at the customer's address");
  return { address, details, note };
}

/** What a booking at `place` stores about where it happens (R630 columns). */
export function placeColumns(place: VisitPlace, address: CustomerAddress | null, travelMinutes: number) {
  return place === "customer" && address
    ? {
        place,
        customerAddress: address.address,
        customerAddressDetails: address.details,
        customerAddressNote: address.note,
        travelMinutes,
      }
    : { place: "business", customerAddress: null, customerAddressDetails: null, customerAddressNote: null, travelMinutes: 0 };
}

/** An interval with its travel time on both sides: what a home visit keeps from other bookings. */
export function padded<T extends Date | number>(start: T, end: T, travelMinutes: number | undefined): { start: number; end: number } {
  // A row without the column (older fixtures) has none
  const pad = Math.max(0, travelMinutes || 0) * MINUTE;
  return { start: new Date(start).getTime() - pad, end: new Date(end).getTime() + pad };
}

/**
 * R630: what a home visit with these services pays for travel — the salon's
 * fee, once, if it applies to any of them; 0 at the business. Twin of
 * `homeVisitFeeOf` in shared-types, which the booking site shows.
 */
export function homeVisitFeeFor<T extends { isZero(): boolean }>(
  place: VisitPlace,
  lines: readonly { homeVisitFeeApplies?: boolean }[],
  salonFee: T,
): T | 0 {
  if (place !== "customer" || salonFee.isZero()) return 0;
  return lines.some((line) => line.homeVisitFeeApplies !== false) ? salonFee : 0;
}
