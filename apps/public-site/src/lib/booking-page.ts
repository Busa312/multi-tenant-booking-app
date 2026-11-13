import type { Location, PublicProfessional, Service } from "@booking/shared-types";
import { getPublicApiClient } from "./api";

export interface BookingPageData {
  services: Service[];
  locations: Location[];
  professionals: PublicProfessional[];
  preselectedServiceIds: string[];
  preselectedLocationId: string | undefined;
}

/**
 * What the booking wizard needs, for the booking page and the embedded one
 * (R410) alike. A preselection from the query is kept only when it names
 * something that exists.
 */
export async function loadBookingPageData(searchParams: {
  serviceIds?: string;
  locationId?: string;
}): Promise<BookingPageData> {
  const api = getPublicApiClient();
  // R240: everyone, with the services they perform — decides which services
  // and branches can be booked at all before the customer picks anything.
  const [services, locations, professionals] = await Promise.all([
    api.listServices(),
    api.listLocations(),
    api.listProfessionals(),
  ]);

  const preselectedServiceIds = (searchParams.serviceIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => services.some((service) => service.id === id));

  const preselectedLocationId = locations.some((location) => location.id === searchParams.locationId)
    ? searchParams.locationId
    : undefined;

  return { services, locations, professionals, preselectedServiceIds, preselectedLocationId };
}
