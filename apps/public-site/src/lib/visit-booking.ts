import type { PublicProfessional, VisitSlot } from "@booking/shared-types";

/**
 * R200/R240 eligibility rules for the booking flow, in one place so every step
 * agrees. The API re-checks all of it; these only decide what to offer.
 */

// R180: null = works at every branch
export const worksAt = (professional: PublicProfessional, locationId: string | null): boolean =>
  locationId === null || professional.locationId === null || professional.locationId === locationId;

export const performs = (professional: PublicProfessional, serviceId: string): boolean =>
  professional.serviceIds.includes(serviceId);

export const qualifiedFor = (
  professionals: readonly PublicProfessional[],
  serviceId: string,
  locationId: string | null,
): PublicProfessional[] =>
  professionals.filter((professional) => worksAt(professional, locationId) && performs(professional, serviceId));

/** People who can do every one of these services — one person for the whole visit. */
export const allRounders = (
  professionals: readonly PublicProfessional[],
  serviceIds: readonly string[],
  locationId: string | null,
): PublicProfessional[] =>
  professionals.filter(
    (professional) => worksAt(professional, locationId) && serviceIds.every((id) => performs(professional, id)),
  );

/** R240: a service nobody performs (anywhere) can't be booked online. */
export const isBookable = (professionals: readonly PublicProfessional[], serviceId: string): boolean =>
  professionals.some((professional) => performs(professional, serviceId));

/** R240: a branch is only offered if every chosen service has someone there. */
export const locationServes = (
  professionals: readonly PublicProfessional[],
  locationId: string,
  serviceIds: readonly string[],
): boolean => serviceIds.every((id) => qualifiedFor(professionals, id, locationId).length > 0);

/**
 * R200: the chosen slot's plan, expanded back to one professional per service —
 * what the booking request sends, so the visit booked is the one shown.
 */
export function professionalIdsFromSlot(slot: VisitSlot, serviceIds: readonly string[]): string[] {
  return serviceIds.map(
    (serviceId) => slot.segments.find((segment) => segment.serviceIds.includes(serviceId))?.professionalId ?? "any",
  );
}

export type BookingStepId = "services" | "location" | "professional" | "time" | "details" | "verify";

/**
 * R440: the booking flow's steps, leaving out any with nothing to choose —
 * services when only one can be booked (it's picked for the customer), the
 * branch when there's one (R150), and the professional when the business has
 * turned that choice off or no chosen service has more than one person who
 * can do it there. Before any service is picked, the professional step is
 * counted in if *some* service would need it, so the progress bar doesn't
 * grow a step the moment one is ticked.
 */
export function bookingSteps(input: {
  services: readonly { id: string }[];
  professionals: readonly PublicProfessional[];
  serviceIds: readonly string[];
  locationId: string | null;
  /** More than one branch, and none preselected by a "Book at …" link. */
  chooseLocation: boolean;
  customersChooseProfessional: boolean;
}): BookingStepId[] {
  const bookable = input.services.filter((service) => isBookable(input.professionals, service.id));
  const considered = input.serviceIds.length > 0 ? input.serviceIds : bookable.map((service) => service.id);
  const realChoice =
    input.customersChooseProfessional &&
    considered.some((id) => qualifiedFor(input.professionals, id, input.locationId).length > 1);

  return [
    ...(bookable.length === 1 ? [] : (["services"] as const)),
    ...(input.chooseLocation ? (["location"] as const) : []),
    ...(realChoice ? (["professional"] as const) : []),
    "time",
    "details",
    "verify",
  ];
}

/** R440: with one bookable service the flow skips choosing it — this is the one it picks. */
export function onlyBookableService(
  services: readonly { id: string }[],
  professionals: readonly PublicProfessional[],
): string | null {
  const bookable = services.filter((service) => isBookable(professionals, service.id));
  return bookable.length === 1 ? (bookable[0]?.id ?? null) : null;
}
