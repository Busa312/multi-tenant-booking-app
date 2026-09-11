import { getPublicApiClient } from "@/lib/api";
import { loadPageContext, resolveCopy } from "@/lib/page-context";
import { TenantIntro } from "@/components/TenantIntro";
import { BookCta } from "@/components/BookCta";
import { ServiceList } from "@/components/ServiceList";
import { LocationList } from "@/components/LocationList";
import styles from "./page.module.css";

export const revalidate = 60;

export default async function HomePage({ params }: { params: { locale: string } }) {
  const context = await loadPageContext(params.locale);
  const api = getPublicApiClient();

  const [services, locations] = await Promise.all([api.listServices(), api.listLocations()]);
  const { title, description } = resolveCopy(context);

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <TenantIntro title={title} description={description} />
        <BookCta label={context.t("home.book")} />
      </div>

      <ServiceList
        services={services}
        heading={context.t("home.servicesTitle")}
        emptyLabel={context.t("home.servicesEmpty")}
        minutesLabel={(count) => context.t("home.minutes", { count })}
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
