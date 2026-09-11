import type { Service } from "@booking/shared-types";
import styles from "./ServiceCard.module.css";

interface ServiceCardProps {
  service: Service;
  minutesLabel: (count: number) => string;
  text: (plain: string, i18n: unknown) => string;
}

export function ServiceCard({ service, minutesLabel, text }: ServiceCardProps) {
  // R160: name and description resolve to the visitor's language

  const name = text(service.name, service.nameI18n);
  const description = service.description ? text(service.description, service.descriptionI18n) : null;

  return (
    <article className={styles.card}>
      <div className={styles.body}>
        <h3 className={styles.name}>{name}</h3>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      <p className={styles.meta}>
        <span className={styles.duration}>{minutesLabel(service.durationMinutes)}</span>
        <span className={styles.price}>{service.price} ₾</span>
      </p>
    </article>
  );
}
