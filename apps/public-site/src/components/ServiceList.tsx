import { groupServices, type Service, type ServiceCategory } from "@booking/shared-types";
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
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <div key={group.category?.id ?? "other"}>
              {titled && (
                <h3 className="mb-2 text-xl font-bold tracking-tight">
                  {group.category ? text(group.category.name, group.category.nameI18n) : otherLabel}
                </h3>
              )}
              <ul className="divide-y divide-base-300 border-y-2 border-accent">
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
