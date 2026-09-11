import type { Location } from "@booking/shared-types";
import { BookCta } from "./BookCta";
import styles from "./LocationCard.module.css";

interface LocationCardProps {
  location: Location;

  bookLabel: string;
  text: (plain: string, i18n: unknown) => string;
}

function mapHref(location: Location, address: string): string {
  const query =
    location.latitude && location.longitude ? `${location.latitude},${location.longitude}` : address;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function LocationCard({ location, bookLabel, text }: LocationCardProps) {
  const name = text(location.name, location.nameI18n);
  const address = text(location.addressLine, location.addressLineI18n);
  const fullAddress = location.city ? `${address}, ${location.city}` : address;

  return (
    <article className={styles.card}>
      <h3 className={styles.name}>{name}</h3>
      <address className={styles.address}>
        <a
          className={styles.link}
          href={mapHref(location, fullAddress)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {fullAddress}
        </a>
        {location.phone && (
          <a className={styles.link} href={`tel:${location.phone.replace(/\s/g, "")}`}>
            {location.phone}
          </a>
        )}
      </address>
      <BookCta label={bookLabel} locationId={location.id} variant="inline" />
    </article>
  );
}
