import type { Translate } from "@/i18n/locales";
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
}

// Built from what the API actually booked (the Visit), not from the draft —
// if the plan shifted at the last moment, this shows the truth.
export function ConfirmationPanel({ confirmation, timezone, locale, t, text, onBookAnother }: ConfirmationPanelProps) {
  const { visit } = confirmation;

  return (
    <section className="flex flex-col gap-5">
      {/* The success header reads as one centred block: mark, heading, what's next. */}
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-success/15 text-success" aria-hidden="true">
          <svg className="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("booking.confirmed.heading")}</h1>
        <p className="max-w-xl text-base-content/70">
          {confirmation.email
            ? t("booking.confirmed.body", { email: confirmation.email })
            : t("booking.confirmed.bodyNoEmail")}
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
          professional: segment.professionalName && text(segment.professionalName, segment.professionalNameI18n),
        }))}
        total={visit.price}
        timezone={timezone}
        locale={locale}
        t={t}
      />

      <div className="flex flex-col items-start gap-2 rounded-box border border-primary/25 bg-primary/5 p-4">
        <a className="btn btn-primary" href={confirmation.manageUrl}>
          {t("booking.confirmed.manageNow")}
        </a>
        <p className="text-sm text-base-content/65">{t("booking.confirmed.noEmailYet")}</p>
      </div>

      <button type="button" className="btn btn-ghost self-center" onClick={onBookAnother}>
        {t("booking.confirmed.bookAnother")}
      </button>
    </section>
  );
}
