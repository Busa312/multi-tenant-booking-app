import Link from "next/link";
import type { Service } from "@booking/shared-types";

interface ServiceCardProps {
  service: Service;
  minutesLabel: (count: number) => string;
  /** Visible label of the per-service booking link; the service name completes it for screen readers. */
  bookLabel: string;
  href: (path: string) => string;
  text: (plain: string, i18n: unknown) => string;
  /** R520: the price as shown — "45 ₾" or "from 45 ₾". */
  price: string;
  /** h4 under a category's h3 (R510), h3 straight under the section's h2. */
  nameTag?: "h3" | "h4";
}

export function ServiceCard({ service, minutesLabel, bookLabel, href, text, price, nameTag: Name = "h3" }: ServiceCardProps) {
  // R160: name and description resolve to the visitor's language
  const name = text(service.name, service.nameI18n);
  const description = service.description ? text(service.description, service.descriptionI18n) : null;

  return (
    // One line of the price list. The link is stretched over the whole row
    // (`after:inset-0`), so the row is one large touch target.
    <article className="group relative flex flex-wrap items-baseline gap-x-6 gap-y-1 py-4">
      <div className="min-w-0 flex-1 basis-64">
        <Name className="text-lg font-semibold">{name}</Name>
        {description && <p className="mt-0.5 text-sm text-pretty text-base-content/65">{description}</p>}
      </div>
      <p className="flex items-baseline gap-4 tabular-nums">
        <span className="text-sm text-base-content/65">{minutesLabel(service.durationMinutes)}</span>
        <span className="text-lg font-bold whitespace-nowrap">{price}</span>
      </p>
      {/* Straight into the wizard with this service already ticked. */}
      <Link
        className="font-semibold whitespace-nowrap text-primary underline-offset-4 group-hover:underline after:absolute after:inset-0"
        href={`${href("/book")}?serviceIds=${encodeURIComponent(service.id)}`}
        aria-label={`${bookLabel}: ${name}`}
      >
        {bookLabel} <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
