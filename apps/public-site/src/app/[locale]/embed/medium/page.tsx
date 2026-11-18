import { priceText } from "@/lib/price";
import { getPublicApiClient } from "@/lib/api";
import { openingTodayLine } from "@/lib/opening-today";
import { loadPageContext } from "@/lib/page-context";
import { EmbedOpenButton } from "@/components/EmbedOpenButton";

export const dynamic = "force-dynamic";

// Rows before the list folds into "+N more".
const SHOWN = 5;

// R410: the medium widget — the salon's name, whether it is open today, its
// first few services with their prices, and the way into booking.
export default async function EmbedMediumPage({ params }: { params: { locale: string } }) {
  const context = await loadPageContext(params.locale);
  const api = getPublicApiClient();
  const [services, hours] = await Promise.all([api.listServices(), api.listOpeningHours().catch(() => [])]);
  const today = openingTodayLine(context, hours);
  const bookHref = context.href("/book");

  return (
    <section className="flex flex-col gap-4 p-5">
      <header>
        <h1 className="text-2xl leading-tight font-extrabold tracking-tight">{context.tenant.name}</h1>
        {today && <p className="mt-0.5 text-sm text-base-content/65">{today}</p>}
      </header>

      {services.length > 0 && (
        <ul className="divide-y divide-base-300 border-y-2 border-accent">
          {services.slice(0, SHOWN).map((service) => {
            const name = context.text(service.name, service.nameI18n);
            return (
              <li key={service.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{name}</p>
                  <p className="text-sm text-base-content/65 tabular-nums">
                    {context.t("home.minutes", { count: service.durationMinutes })} ·{" "}
                    {priceText(context.t, service.price, service.priceFrom)}
                  </p>
                </div>
                <EmbedOpenButton
                  serviceIds={[service.id]}
                  fallbackHref={`${bookHref}?serviceIds=${encodeURIComponent(service.id)}`}
                  className="flex-none font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline"
                  ariaLabel={`${context.t("home.bookService")}: ${name}`}
                >
                  {context.t("home.bookService")} <span aria-hidden="true">→</span>
                </EmbedOpenButton>
              </li>
            );
          })}
        </ul>
      )}
      {services.length > SHOWN && (
        <p className="-mt-2 text-sm text-base-content/65">{context.t("embed.moreServices", { count: services.length - SHOWN })}</p>
      )}

      <EmbedOpenButton fallbackHref={bookHref} className="btn btn-primary w-full">
        {context.t("home.book")}
      </EmbedOpenButton>
    </section>
  );
}
