import type { Service } from "@booking/shared-types";
import { ServiceCard } from "./ServiceCard";

interface ServiceListProps {
  services: Service[];
  heading: string;
  emptyLabel: string;
  minutesLabel: (count: number) => string;
  bookLabel: string;
  text: (plain: string, i18n: unknown) => string;
}

export function ServiceList({ services, heading, emptyLabel, minutesLabel, bookLabel, text }: ServiceListProps) {
  return (
    <section aria-labelledby="services-heading">
      <h2 className="mb-4 text-xl font-bold tracking-tight" id="services-heading">
        {heading}
      </h2>

      {services.length === 0 ? (
        <p className="rounded-box bg-base-200 px-5 py-8 text-center text-base-content/60">{emptyLabel}</p>
      ) : (
        <ul className="grid gap-3">
          {services.map((service) => (
            <li key={service.id}>
              <ServiceCard service={service} minutesLabel={minutesLabel} bookLabel={bookLabel} text={text} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
