import type { Service } from "@booking/shared-types";
import { ServiceCard } from "./ServiceCard";

interface ServiceListProps {
  services: Service[];
  heading: string;
  emptyLabel: string;
  minutesLabel: (count: number) => string;
  bookLabel: string;
  href: (path: string) => string;
  text: (plain: string, i18n: unknown) => string;
}

export function ServiceList({ services, heading, emptyLabel, minutesLabel, bookLabel, href, text }: ServiceListProps) {
  return (
    <section aria-labelledby="services-heading">
      <h2 className="mb-4 text-2xl font-extrabold tracking-tight" id="services-heading">
        {heading}
      </h2>

      {services.length === 0 ? (
        <p className="border-y-2 border-accent py-8 text-base-content/65">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-base-300 border-y-2 border-accent">
          {services.map((service) => (
            <li key={service.id}>
              <ServiceCard service={service} minutesLabel={minutesLabel} bookLabel={bookLabel} href={href} text={text} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
