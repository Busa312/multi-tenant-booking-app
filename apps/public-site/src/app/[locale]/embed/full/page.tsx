import { getMessages } from "@/i18n/locales";
import { loadBookingPageData } from "@/lib/booking-page";
import { loadPageContext } from "@/lib/page-context";
import { isValidTimezone } from "@/lib/tenant-time";
import { BookingWizard } from "@/components/BookingWizard";
import { EmbedCloseButton } from "@/components/EmbedCloseButton";
import { UnavailableNotice } from "@/components/UnavailableNotice";

export const dynamic = "force-dynamic";

// R410: the whole booking flow, inline on the salon's site or in the overlay a
// smaller widget opens (`overlay=1`, which adds a close button).
export default async function EmbedFullPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { serviceIds?: string; locationId?: string; overlay?: string };
}) {
  const context = await loadPageContext(params.locale);
  const overlay = searchParams.overlay === "1";

  if (!isValidTimezone(context.tenant.timezone)) {
    return (
      <div className="p-5">
        <UnavailableNotice heading={context.t("booking.unavailableHeading")} body={context.t("booking.unavailableBody")} />
      </div>
    );
  }

  // R490: the business's subscription has lapsed
  if (context.tenant.bookingPaused) {
    return (
      <div className="p-5">
        <UnavailableNotice heading={context.t("booking.pausedHeading")} body={context.t("booking.pausedBody")} />
      </div>
    );
  }

  const data = await loadBookingPageData(searchParams);

  return (
    <div className="px-4 pt-4 pb-6 sm:px-6">
      {overlay && (
        <div className="-mb-2 flex justify-end">
          <EmbedCloseButton label={context.t("embed.close")} />
        </div>
      )}
      <BookingWizard
        services={data.services}
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
        embedded
      />
    </div>
  );
}
