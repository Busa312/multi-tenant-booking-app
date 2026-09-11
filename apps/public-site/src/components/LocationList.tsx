import type { Location } from "@booking/shared-types";
import { LocationCard } from "./LocationCard";
import styles from "./LocationList.module.css";

interface LocationListProps {
  locations: Location[];
  heading: string;

  bookLabel: (name: string) => string;
  text: (plain: string, i18n: unknown) => string;
}

// R150: where the business
export function LocationList({ locations, heading, bookLabel, text }: LocationListProps) {
  if (locations.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="locations-heading">
      <h2 className={styles.heading} id="locations-heading">
        {heading}
      </h2>
      <ul className={styles.list} data-single={locations.length === 1 || undefined}>
        {locations.map((location) => (
          <li key={location.id}>
            <LocationCard
              location={location}
              bookLabel={bookLabel(text(location.name, location.nameI18n))}
              text={text}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
