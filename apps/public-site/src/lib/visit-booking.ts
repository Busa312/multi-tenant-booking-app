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
