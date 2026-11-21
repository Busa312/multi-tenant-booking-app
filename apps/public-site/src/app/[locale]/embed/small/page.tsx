import { getPublicApiClient } from "@/lib/api";
import { openingTodayLine } from "@/lib/opening-today";
import { loadPageContext } from "@/lib/page-context";
import { EmbedOpenButton } from "@/components/EmbedOpenButton";

export const dynamic = "force-dynamic";

// R410: the small widget — one line about the salon and one button.
export default async function EmbedSmallPage({ params }: { params: { locale: string } }) {
  const context = await loadPageContext(params.locale);
  const hours = await getPublicApiClient()
    .listOpeningHours()
    .catch(() => []);
  const today = openingTodayLine(context, hours);

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate text-lg leading-tight font-semibold tracking-tight">{context.tenant.name}</p>
        {today && <p className="text-sm text-base-content/65">{today}</p>}
      </div>
      <EmbedOpenButton fallbackHref={context.href("/book")} className="btn btn-primary">
        {context.t("home.book")}
      </EmbedOpenButton>
    </section>
  );
}
