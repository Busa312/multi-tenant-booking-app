import { groupServices, type Service, type ServiceCategory } from "@booking/shared-types";
import { DisclosureChevron } from "./DisclosureChevron";
import { ServiceCard } from "./ServiceCard";

interface ServiceListProps {
  services: Service[];
  /** R510: the salon's headings, in its order. */
  categories: ServiceCategory[];
  heading: string;
  emptyLabel: string;
  /** The heading of services in no category, when there are categories too. */
  otherLabel: string;
  minutesLabel: (count: number) => string;
  bookLabel: string;
  /** R520: "45 ₾" or "from 45 ₾". */
  priceLabel: (service: Service) => string;
  href: (path: string) => string;
  text: (plain: string, i18n: unknown) => string;
}

// R510: the price list, under the salon's own headings when it has them.
export function ServiceList({
  services,
  categories,
  heading,
  emptyLabel,
  otherLabel,
  minutesLabel,
  bookLabel,
  priceLabel,
  href,
  text,
}: ServiceListProps) {
  const groups = groupServices(services, categories);
  const titled = groups.some((group) => group.category !== null);

  return (
    <section aria-labelledby="services-heading">
      <h2 className="mb-4 text-2xl font-extrabold tracking-tight" id="services-heading">
        {heading}
      </h2>

      {services.length === 0 ? (
        <p className="border-y-2 border-accent py-8 text-base-content/65">{emptyLabel}</p>
      ) : (
        <div className={titled ? "border-b-2 border-accent" : undefined}>
          {groups.map((group, index) => {
            const list = (
              <ul className={titled ? "divide-y divide-base-300 border-t border-base-300" : "divide-y divide-base-300 border-y-2 border-accent"}>
                {group.services.map((service) => (
                  <li key={service.id}>
                    <ServiceCard
                      service={service}
                      minutesLabel={minutesLabel}
                      bookLabel={bookLabel}
                      price={priceLabel(service)}
                      href={href}
                      text={text}
                      nameTag={titled ? "h4" : "h3"}
                    />
                  </li>
                ))}
              </ul>
            );
            if (!titled) return <div key="all">{list}</div>;
            // R510: each category opens and closes on its own; the first starts open.
            // Native <details>: no script, keyboard and screen readers for free, and
            // the browser's find-in-page opens a closed category to show a match.
            return (
              <details key={group.category?.id ?? "other"} className="group border-t-2 border-accent" open={index === 0}>
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
                  <h3 className="text-xl font-bold tracking-tight">
                    {group.category ? text(group.category.name, group.category.nameI18n) : otherLabel}
                  </h3>
                  <span className="text-sm text-base-content/60 tabular-nums">· {group.services.length}</span>
                  <span className="ml-auto">
                    <DisclosureChevron />
                  </span>
                </summary>
                {list}
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
