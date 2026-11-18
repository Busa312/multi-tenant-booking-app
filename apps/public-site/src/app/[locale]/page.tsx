import { getPublicApiClient } from "@/lib/api";
import { loadPageContext, resolveCopy } from "@/lib/page-context";
import { todayInTimezone } from "@/lib/tenant-time";
import { priceText } from "@/lib/price";
import { TenantIntro } from "@/components/TenantIntro";
import { BookCta } from "@/components/BookCta";
import { ServiceList } from "@/components/ServiceList";
import { OpeningHoursList } from "@/components/OpeningHoursList";
import { LocationList } from "@/components/LocationList";

export const revalidate = 60;

export default async function HomePage({ params }: { params: { locale: string } }) {
  const context = await loadPageContext(params.locale);
  const api = getPublicApiClient();

  const [services, categories, locations, hours] = await Promise.all([
    api.listServices(),
    // R510
    api.listServiceCategories(),
    api.listLocations(),
    // R390: the page still renders if the hours can't be fetched
    api.listOpeningHours().catch(() => []),
  ]);
  const { title, description } = resolveCopy(context);
  // Today's weekday on the salon's calendar, not the server's.
  const today = new Date(`${todayInTimezone(context.tenant.timezone)}T00:00:00Z`).getUTCDay();

  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      {/* The salon's own color, flat and full strength — its poster, not a tint of it. */}
      <div className="flex flex-col items-start gap-8 rounded-box bg-primary px-6 py-10 text-primary-content sm:px-10 sm:py-14">
        <TenantIntro title={title} description={description} />
        <BookCta label={context.t("home.book")} href={context.href} />
      </div>

      <ServiceList
        services={services}
        categories={categories}
        heading={context.t("home.servicesTitle")}
        emptyLabel={context.t("home.servicesEmpty")}
        otherLabel={context.t("home.otherServices")}
        minutesLabel={(count) => context.t("home.minutes", { count })}
        bookLabel={context.t("home.bookService")}
        priceLabel={(service) => priceText(context.t, service.price, service.priceFrom)}
        href={context.href}
        text={context.text}
      />

      <OpeningHoursList
        hours={hours}
        today={today}
        locale={context.locale}
        heading={context.t("home.hoursTitle")}
        closedLabel={context.t("home.closed")}
        todayLabel={context.t("booking.time.today")}
      />

      <LocationList
        locations={locations}
        heading={context.t("home.locationsTitle")}
        bookLabel={(name) => context.t("home.bookAt", { name })}
        href={context.href}
        text={context.text}
      />
    </div>
  );
}
