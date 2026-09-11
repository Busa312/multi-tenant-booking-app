import type { Location, Service } from "@booking/shared-types";
import type { Translate } from "@/i18n/locales";
import { formatInstant } from "@/lib/tenant-time";
import styles from "./BookingSummary.module.css";

interface BookingSummaryProps {
  services: Service[];
  location: Location | null;
  professionalName: string | null;
  startAt: string | null;
  timezone: string;
  locale: string;
  t: Translate;
  text: (plain: string, i18n: unknown) => string;
}

export function BookingSummary({
  services,
  location,
  professionalName,
  startAt,
  timezone,
  locale,
  t,
  text,
}: BookingSummaryProps) {
  const total = services.reduce((sum, service) => sum + Number(service.price), 0);

  return (
    <dl className={styles.summary}>
      <div className={styles.row}>
        <dt className={styles.term}>{t("booking.summary.services")}</dt>
        <dd className={styles.value}>{services.map((s) => text(s.name, s.nameI18n)).join(", ")}</dd>
      </div>

      {startAt && (
        <div className={styles.row}>
          <dt className={styles.term}>{t("booking.summary.when")}</dt>
          <dd className={styles.value}>{formatInstant(startAt, timezone, locale)}</dd>
        </div>
      )}

      {location && (
        <div className={styles.row}>
          <dt className={styles.term}>{t("booking.summary.location")}</dt>
          <dd className={styles.value}>
            {text(location.name, location.nameI18n)} — {text(location.addressLine, location.addressLineI18n)}
          </dd>
        </div>
      )}

      {professionalName && (
        <div className={styles.row}>
          <dt className={styles.term}>{t("booking.summary.professional")}</dt>
          <dd className={styles.value}>{professionalName}</dd>
        </div>
      )}

      <div className={styles.row}>
        <dt className={styles.term}>{t("booking.summary.total")}</dt>
        <dd className={styles.total}>{total.toFixed(2)} ₾</dd>
      </div>
    </dl>
  );
}
