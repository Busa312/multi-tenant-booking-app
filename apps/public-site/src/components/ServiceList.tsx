import { groupServices, type Service, type ServiceCategory } from "@booking/shared-types";
import { DisclosureChevron } from "./DisclosureChevron";
import { ServiceCard } from "./ServiceCard";
import { SECTION_HEADING, TILE } from "@/lib/pageClasses";

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
  /** R630: "At your address" and the like; null for a service only at the salon. */
  placeLabel?: (service: Service) => string | null;
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
  placeLabel,
}: ServiceListProps) {
  const groups = groupServices(services, categories);
  const titled = groups.some((group) => group.category !== null);

  return (
    // The hero's "Services" link jumps here (the page's scroll padding clears the sticky header).
    <section aria-labelledby="services-heading" id="services">
      <h2 className={`mb-6 ${SECTION_HEADING}`} id="services-heading">
        {heading}
      </h2>

      {services.length === 0 ? (
        <p className={`${TILE} px-5 py-8 text-base-content/65`}>{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group, index) => {
            // The tile pads the list by 8px on every side, the room a row's inset hover
            // highlight (ServiceCard) needs to stay clear of the tile's edge.
            const list = (
              <ul className="divide-y divide-base-300">
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
                      placeLabel={placeLabel?.(service)}
                    />
                  </li>
                ))}
              </ul>
            );
            if (!titled) {
              return (
                <div key="all" className={`${TILE} px-5 py-2`}>
                  {list}
                </div>
              );
            }
            // R510: each category is a tile that opens and closes on its own; the first starts open.
            // Native <details>: no script, keyboard and screen readers for free, and
            // the browser's find-in-page opens a closed category to show a match.
            return (
              <details key={group.category?.id ?? "other"} className={`group ${TILE} px-5`} open={index === 0}>
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-4 [&::-webkit-details-marker]:hidden">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {group.category ? text(group.category.name, group.category.nameI18n) : otherLabel}
                  </h3>
                  <span className="text-sm text-base-content/50 tabular-nums">{group.services.length}</span>
                  <span className="ml-auto">
                    <DisclosureChevron />
                  </span>
                </summary>
                <div className="border-t border-base-300 py-2">{list}</div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
