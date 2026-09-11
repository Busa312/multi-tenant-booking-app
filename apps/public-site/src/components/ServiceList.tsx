import type { Service } from "@booking/shared-types";
import { ServiceCard } from "./ServiceCard";
import styles from "./ServiceList.module.css";

interface ServiceListProps {
  services: Service[];
  heading: string;
  emptyLabel: string;
  minutesLabel: (count: number) => string;
  text: (plain: string, i18n: unknown) => string;
}

export function ServiceList({ services, heading, emptyLabel, minutesLabel, text }: ServiceListProps) {
  return (
    <section className={styles.section} aria-labelledby="services-heading">
      <h2 className={styles.heading} id="services-heading">
        {heading}
      </h2>

      {services.length === 0 ? (
        <p className={styles.empty}>{emptyLabel}</p>
      ) : (
        <ul className={styles.list}>
          {services.map((service) => (
            <li key={service.id}>
              <ServiceCard service={service} minutesLabel={minutesLabel} text={text} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
