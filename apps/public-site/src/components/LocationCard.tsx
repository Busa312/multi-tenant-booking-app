import { localizedAddress } from "@booking/shared-types";
import type { Location } from "@booking/shared-types";
import { TILE } from "@/lib/pageClasses";
import { BookCta } from "./BookCta";

interface LocationCardProps {
  location: Location;

  bookLabel: string;
  href: (path: string) => string;
  text: (plain: string, i18n: unknown) => string;
}

function mapHref(location: Location, address: string): string {
  const query =
    location.latitude && location.longitude ? `${location.latitude},${location.longitude}` : address;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function LocationCard({ location, bookLabel, href, text }: LocationCardProps) {
  const name = text(location.name, location.nameI18n);
  const fullAddress = localizedAddress(location, text);

  return (
    <article className={`h-full ${TILE} p-6`}>
      <div className="flex h-full flex-col gap-3">
        <h3 className="text-xl font-semibold tracking-tight">{name}</h3>
        <address className="flex flex-col gap-1.5 not-italic">
          <a
            className="inline-flex items-start gap-2 text-base-content/70 hover:text-base-content hover:underline"
            href={mapHref(location, fullAddress)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg className="mt-1 size-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {fullAddress}
          </a>
          {location.phone && (
            <a
              className="inline-flex items-center gap-2 text-base-content/70 hover:text-base-content hover:underline"
              href={`tel:${location.phone.replace(/\s/g, "")}`}
            >
              <svg className="size-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
              </svg>
              {location.phone}
            </a>
          )}
        </address>
        <div className="mt-auto pt-2">
          <BookCta label={bookLabel} href={href} locationId={location.id} variant="inline" />
        </div>
      </div>
    </article>
  );
}
