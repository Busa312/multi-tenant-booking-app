import type { Metadata } from "next";
import { getPublicApiClient } from "@/lib/api";
import { loadPageContext } from "@/lib/page-context";
import { getMessages } from "@/i18n/locales";
import { isValidTimezone } from "@/lib/tenant-time";
import { BookingWizard } from "@/components/BookingWizard";
import { UnavailableNotice } from "@/components/UnavailableNotice";

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const context = await loadPageContext(params.locale);
  return { title: context.t("booking.title") };
}

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
  // R240: everyone, with the services they perform — decides which services
  // and branches can be booked at all before the customer picks anything.
  const [services, locations, professionals] = await Promise.all([
    api.listServices(),
    api.listLocations(),
    api.listProfessionals(),
  ]);

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
      professionals={professionals}
      preselectedServiceIds={preselected}
      preselectedLocationId={preselectedLocationId}
      timezone={context.tenant.timezone}
      maxAdvanceDays={context.tenant.maxBookingAdvanceDays}
      locale={context.locale}
      defaultLocale={context.defaultLocale}
      messages={getMessages(context.locale)}
    />
  );
}
