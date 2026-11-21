import type { Translate } from "@/i18n/locales";
import { PAGE_HEADING } from "@/lib/wizardClasses";
import { BookingSummary } from "./BookingSummary";
import type { Confirmation } from "./BookingWizard";

interface ConfirmationPanelProps {
  confirmation: Confirmation;
  timezone: string;
  locale: string;
  t: Translate;
  /** R160: a name in the visitor's language, from its translations. */
  text: (plain: string, i18n: unknown) => string;
  /** Start a new booking — the confirmation otherwise stays put, even across a language switch. */
  onBookAnother: () => void;
  /** R410: open the manage page in a new tab (when this is framed by another site). */
  manageInNewTab?: boolean;
  /** R440: false = never name who will do the job. */
  showProfessionals: boolean;
}

// Built from what the API actually booked (the Visit), not from the draft —
// if the plan shifted at the last moment, this shows the truth.
export function ConfirmationPanel({
  confirmation,
  timezone,
  locale,
  t,
  text,
  onBookAnother,
  manageInNewTab = false,
  showProfessionals,
}: ConfirmationPanelProps) {
  const { visit } = confirmation;

  return (
    <section className="flex flex-col gap-5">
      {/* Mark, heading, what's next — set flush left like the rest of the flow. */}
      <header className="flex flex-col items-start gap-3">
        <svg className="size-14 rounded-full bg-success p-3.5 text-success-content" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <h1 className={PAGE_HEADING}>{t("booking.confirmed.heading")}</h1>
        <p className="max-w-xl text-pretty text-base-content/65">
          {/* R270: texted to the verified phone once SMS is live; until then this screen is the copy */}
          {confirmation.linkTexted
            ? t("booking.confirmed.bodyTexted", { phone: confirmation.phoneNumber })
            : t("booking.confirmed.bodyKeepLink")}
        </p>
      </header>

      <BookingSummary
        startAt={visit.startAt}
        location={visit.locationName && text(visit.locationName, visit.locationNameI18n)}
        plan={visit.segments.map((segment) => ({
          key: segment.appointmentId,
          startAt: segment.startAt,
          endAt: segment.endAt,
          services: segment.services.map((line) => text(line.name, line.nameI18n)).join(", "),
          professional:
            showProfessionals && segment.professionalName
              ? text(segment.professionalName, segment.professionalNameI18n)
              : null,
        }))}
        total={visit.price}
        totalFrom={visit.priceFrom}
        timezone={timezone}
        locale={locale}
        t={t}
      />

      <div className="flex flex-col items-start gap-3 rounded-box bg-base-200 p-5">
        <a
          className="btn btn-primary"
          href={confirmation.manageUrl}
          target={manageInNewTab ? "_blank" : undefined}
          rel={manageInNewTab ? "noopener noreferrer" : undefined}
        >
          {t("booking.confirmed.manageNow")}
        </a>
        <p className="text-sm text-base-content/65">{t("booking.confirmed.keepLinkHint")}</p>
      </div>

      <button type="button" className="btn btn-ghost self-start" onClick={onBookAnother}>
        {t("booking.confirmed.bookAnother")}
      </button>
    </section>
  );
}
