import type { Location } from "@booking/shared-types";
import { SECTION_HEADING } from "@/lib/pageClasses";
import { LocationCard } from "./LocationCard";

interface LocationListProps {
  locations: Location[];
  heading: string;

  bookLabel: (name: string) => string;
  href: (path: string) => string;
  text: (plain: string, i18n: unknown) => string;
}

// R150: where the business
export function LocationList({ locations, heading, bookLabel, href, text }: LocationListProps) {
  if (locations.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="locations-heading">
      <h2 className={`mb-6 ${SECTION_HEADING}`} id="locations-heading">
        {heading}
      </h2>
      {/* One branch takes the full width rather than sitting alone in a half column. */}
      <ul className={locations.length === 1 ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
        {locations.map((location) => (
          <li key={location.id}>
            <LocationCard
              location={location}
              bookLabel={bookLabel(text(location.name, location.nameI18n))}
              href={href}
              text={text}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
