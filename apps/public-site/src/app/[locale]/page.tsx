import { getPublicApiClient } from "@/lib/api";
import { loadPageContext, resolveCopy, titleNamesSalon } from "@/lib/page-context";
import { todayInTimezone } from "@/lib/tenant-time";
import { priceText } from "@/lib/price";
import { TenantIntro } from "@/components/TenantIntro";
import { BookCta } from "@/components/BookCta";
import { ServiceList } from "@/components/ServiceList";
import { OpeningHoursList } from "@/components/OpeningHoursList";
import { LocationList } from "@/components/LocationList";
import { ChevronRight } from "@/components/ChevronRight";
import { MORE_LINK } from "@/lib/pageClasses";

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
    <div className="flex flex-col gap-20 sm:gap-28">
      {/* A product page's opening: the salon's words, large and centered, and one clear action. */}
      <div className="flex flex-col items-center gap-9 pt-4 text-center sm:pt-8">
        <TenantIntro
          // The salon's name above its own title, unless the title already says it (in any language).
          eyebrow={titleNamesSalon(context) ? null : context.tenant.name}
          title={title}
          description={description}
        />
        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
          <BookCta label={context.t("home.book")} href={context.href} />
          {services.length > 0 && (
            <a className={MORE_LINK} href="#services">
              {context.t("home.servicesTitle")}
              <ChevronRight />
            </a>
          )}
        </div>
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
