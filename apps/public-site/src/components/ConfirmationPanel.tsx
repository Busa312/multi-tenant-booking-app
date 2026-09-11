import type { Location, Service } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import { BookingSummary } from "./BookingSummary";
import type { Confirmation } from "./BookingWizard";
import styles from "./ConfirmationPanel.module.css";

interface ConfirmationPanelProps {
  confirmation: Confirmation;
  services: Service[];
  location: Location | null;
  professionalName: string | null;
  timezone: string;
  locale: string;
  t: Translate;
  text: (plain: string, i18n: unknown) => string;
}

export function ConfirmationPanel({
  confirmation,
  services,
  location,
  professionalName,
  timezone,
  locale,
  t,
  text,
}: ConfirmationPanelProps) {
  return (
    <section className={styles.panel}>
      <h1 className={styles.heading}>{t("booking.confirmed.heading")}</h1>
      <p className={styles.body}>
        {confirmation.email
          ? t("booking.confirmed.body", { email: confirmation.email })
          : t("booking.confirmed.bodyNoEmail")}
      </p>

      <BookingSummary
        services={services}
        location={location}
        professionalName={professionalName}
        startAt={confirmation.startAt}
        timezone={timezone}
        locale={locale}
        t={t}
        text={text}
      />

      <div className={styles.actions}>
        <a className={styles.manage} href={confirmation.manageUrl}>
          {t("booking.confirmed.manageNow")}
        </a>
        <p className={styles.note}>{t("booking.confirmed.noEmailYet")}</p>
      </div>
    </section>
  );
}
