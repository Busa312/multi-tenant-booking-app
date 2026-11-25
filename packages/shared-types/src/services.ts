import type { ServiceCategory, ServicePlace, VisitPlace } from "./entities";

/**
 * R510: one heading of a salon's price list and what's under it. `category`
 * null = the uncategorized services.
 */
export interface ServiceGroup<T> {
  category: ServiceCategory | null;
  services: T[];
}

/**
 * R510: services under their categories, in the salon's order — what the
 * booking site and the CMS both show. `services` arrive already in order (the
 * API sorts them); categories keep theirs. Empty categories are kept only when
 * asked (the CMS shows them so they can be filled; the booking site doesn't).
 * Services in no category — or in one that's gone — come last, and stand alone
 * when there are no categories at all.
 */
export function groupServices<T extends { categoryId: string | null }>(
  services: readonly T[],
  categories: readonly ServiceCategory[],
  options: { keepEmpty?: boolean } = {},
): ServiceGroup<T>[] {
  const known = new Set(categories.map((category) => category.id));
  const groups: ServiceGroup<T>[] = categories
    .map((category) => ({ category, services: services.filter((service) => service.categoryId === category.id) }))
    .filter((group) => options.keepEmpty || group.services.length > 0);
  const rest = services.filter((service) => !service.categoryId || !known.has(service.categoryId));
  if (rest.length > 0 || groups.length === 0) groups.push({ category: null, services: rest });
  return groups;
}

/**
 * R630: whether a service set up for `servicePlace` can be booked at `place`
 * ("either" fits both). The API keeps a twin in booking/service-place.ts.
 */
export function offeredAt(servicePlace: ServicePlace, place: VisitPlace): boolean {
  return servicePlace === "either" || servicePlace === place;
}

/** R630: whether a salon offers anything at the customer's address — and so asks "Where?". */
export function offersHomeVisits(services: readonly { place: ServicePlace }[]): boolean {
  return services.some((service) => service.place !== "business");
}

/**
 * R630: what a home visit with these services pays for travel — the salon's
 * fee, once, if it applies to any of them. "0" = none. The API decides the same way.
 */
export function homeVisitFeeOf(services: readonly { homeVisitFeeApplies: boolean }[], salonFee: string): string {
  return services.some((service) => service.homeVisitFeeApplies) && Number(salonFee) > 0 ? salonFee : "0";
}
