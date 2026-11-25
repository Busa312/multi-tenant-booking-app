import Link from "next/link";
import type { Service } from "@booking/shared-types";

interface ServiceCardProps {
  service: Service;
  minutesLabel: (count: number) => string;
  /** The pill's label; with the service name it is the row link's accessible name. */
  bookLabel: string;
  href: (path: string) => string;
  text: (plain: string, i18n: unknown) => string;
  /** R520: the price as shown — "45 ₾" or "from 45 ₾". */
  price: string;
  /** h4 under a category's h3 (R510), h3 straight under the section's h2. */
  nameTag?: "h3" | "h4";
  /** R630: where it can take place, when that isn't only at the salon. */
  placeLabel?: string | null;
}

export function ServiceCard({ service, minutesLabel, bookLabel, href, text, price, nameTag: Name = "h3", placeLabel }: ServiceCardProps) {
  // R160: name and description resolve to the visitor's language
  const name = text(service.name, service.nameI18n);
  const description = service.description ? text(service.description, service.descriptionI18n) : null;

  return (
    // One row of an inset list, and the whole row is the link — straight into
    // the wizard with this service already ticked. It highlights on hover like
    // a list row; the pill at the end, like an app store's "Get", says what a
    // press does. The highlight is inset (-mx-3/px-3) so it keeps clear of the
    // tile's rounded edge.
    <Link
      className="-mx-3 flex items-center gap-4 rounded-xl px-3 py-4 transition-colors hover:bg-base-300/50 active:bg-base-300/70 motion-reduce:transition-none"
      href={`${href("/book")}?serviceIds=${encodeURIComponent(service.id)}`}
      aria-label={`${bookLabel}: ${name}`}
    >
      <div className="min-w-0 flex-1">
        <Name className="font-semibold">{name}</Name>
        {description && <p className="mt-0.5 text-sm text-pretty text-base-content/65">{description}</p>}
        <p className="mt-1 text-sm text-base-content/65 tabular-nums">
          {minutesLabel(service.durationMinutes)}
          {placeLabel && ` · ${placeLabel}`}
        </p>
      </div>
      <p className="font-semibold whitespace-nowrap tabular-nums">{price}</p>
      <span className="btn btn-soft btn-primary btn-sm flex-none px-4" aria-hidden="true">
        {bookLabel}
      </span>
    </Link>
  );
}
