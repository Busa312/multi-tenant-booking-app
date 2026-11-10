import { getPublicApiClient } from "@/lib/api";
import { loadPageContext, resolveCopy } from "@/lib/page-context";
import { TenantIntro } from "@/components/TenantIntro";
import { BookCta } from "@/components/BookCta";
import { ServiceList } from "@/components/ServiceList";
import { LocationList } from "@/components/LocationList";

export const revalidate = 60;

export default async function HomePage({ params }: { params: { locale: string } }) {
  const context = await loadPageContext(params.locale);
  const api = getPublicApiClient();

  const [services, locations] = await Promise.all([api.listServices(), api.listLocations()]);
  const { title, description } = resolveCopy(context);

  return (
    <div className="flex flex-col gap-12">
      <div className="relative overflow-hidden rounded-box border border-base-300 bg-linear-to-br from-primary/12 via-base-200 to-secondary/10 px-6 py-10 sm:px-10 sm:py-14">
        <div
          className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-primary/15 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col items-start gap-7">
          <TenantIntro title={title} description={description} />
          <BookCta label={context.t("home.book")} />
        </div>
      </div>

      <ServiceList
        services={services}
        heading={context.t("home.servicesTitle")}
        emptyLabel={context.t("home.servicesEmpty")}
        minutesLabel={(count) => context.t("home.minutes", { count })}
        bookLabel={context.t("home.bookService")}
        text={context.text}
      />

      <LocationList
        locations={locations}
        heading={context.t("home.locationsTitle")}
        bookLabel={(name) => context.t("home.bookAt", { name })}
        text={context.text}
      />
    </div>
  );
}
