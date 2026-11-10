import Link from "next/link";
import type { Service } from "@booking/shared-types";

interface ServiceCardProps {
  service: Service;
  minutesLabel: (count: number) => string;
  /** Visible label of the per-service booking link; the service name completes it for screen readers. */
  bookLabel: string;
  text: (plain: string, i18n: unknown) => string;
}

export function ServiceCard({ service, minutesLabel, bookLabel, text }: ServiceCardProps) {
  // R160: name and description resolve to the visitor's language
  const name = text(service.name, service.nameI18n);
  const description = service.description ? text(service.description, service.descriptionI18n) : null;

  return (
    <article className="card card-border border-base-300 bg-base-100 transition-shadow hover:shadow-md">
      <div className="card-body flex-row flex-wrap items-center gap-x-4 gap-y-3 p-5">
        <div className="min-w-0 flex-1 basis-56">
          <h3 className="text-base font-semibold">{name}</h3>
          {description && <p className="mt-1 text-sm text-base-content/65">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="badge badge-ghost border-base-300 tabular-nums">{minutesLabel(service.durationMinutes)}</span>
          <span className="font-bold whitespace-nowrap tabular-nums">{service.price} ₾</span>
          {/* Straight into the wizard with this service already ticked. */}
          <Link
            className="btn btn-primary btn-sm btn-soft"
            href={`/book?serviceIds=${encodeURIComponent(service.id)}`}
            aria-label={`${bookLabel}: ${name}`}
          >
            {bookLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}
