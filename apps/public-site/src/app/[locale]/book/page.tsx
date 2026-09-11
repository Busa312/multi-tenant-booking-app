import { getPublicApiClient } from "@/lib/api";
import { loadPageContext } from "@/lib/page-context";
import { getMessages } from "@/i18n/locales";
import { isValidTimezone } from "@/lib/tenant-time";
import { BookingWizard } from "@/components/BookingWizard";
import { UnavailableNotice } from "@/components/UnavailableNotice";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { serviceIds?: string; locationId?: string };
}) {
  const context = await loadPageContext(params.locale);

  if (!isValidTimezone(context.tenant.timezone)) {
    return (
      <UnavailableNotice
        heading={context.t("booking.unavailableHeading")}
        body={context.t("booking.unavailableBody")}
      />
    );
  }

  const api = getPublicApiClient();
  const [services, locations] = await Promise.all([api.listServices(), api.listLocations()]);

  const preselected = (searchParams.serviceIds ?? "")
    .split(",")
    .map((id) => id.trim())

    .filter((id) => services.some((service) => service.id === id));

  const preselectedLocationId = locations.some((location) => location.id === searchParams.locationId)
    ? searchParams.locationId
    : undefined;

  return (
    <BookingWizard
      services={services}
      locations={locations}
      preselectedServiceIds={preselected}
      preselectedLocationId={preselectedLocationId}
      timezone={context.tenant.timezone}
      locale={context.locale}
      defaultLocale={context.defaultLocale}
      messages={getMessages(context.locale)}
    />
  );
}
