import { headers } from "next/headers";
import type { Metadata } from "next";
import { loadBookingPageData } from "@/lib/booking-page";
import { loadPageContext } from "@/lib/page-context";
import { getMessages } from "@/i18n/locales";
import { isValidTimezone } from "@/lib/tenant-time";
import { BookingWizard } from "@/components/BookingWizard";
import { UnavailableNotice } from "@/components/UnavailableNotice";
import { isBookingPausedNow } from "@/lib/tenant-config";

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

  // R490: the business's subscription has lapsed — confirmed live, not just from the cache
  if (context.tenant.bookingPaused && (await isBookingPausedNow(headers().get("host") ?? ""))) {
    return <UnavailableNotice heading={context.t("booking.pausedHeading")} body={context.t("booking.pausedBody")} />;
  }

  const data = await loadBookingPageData(searchParams);

  return (
    <BookingWizard
      services={data.services}
      serviceCategories={data.serviceCategories}
      locations={data.locations}
      professionals={data.professionals}
      preselectedServiceIds={data.preselectedServiceIds}
      preselectedLocationId={data.preselectedLocationId}
      timezone={context.tenant.timezone}
      maxAdvanceDays={context.tenant.maxBookingAdvanceDays}
      customersChooseProfessional={context.tenant.customersChooseProfessional}
      locale={context.locale}
      defaultLocale={context.defaultLocale}
      messages={getMessages(context.locale)}
    />
  );
}
