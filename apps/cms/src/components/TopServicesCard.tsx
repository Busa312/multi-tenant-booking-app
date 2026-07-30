import { useI18n } from "../i18n/I18nContext.js";
import { formatMinor, type TopServiceStat } from "../lib/dashboardStats.js";
import { Card, Eyebrow } from "./ui/index.js";
import styles from "./TopServicesCard.module.css";

interface TopServicesCardProps {
  services: TopServiceStat[];
  /**
   * Owner only. A `professional` login has no access to pricing, so the value
   * column and its note are left out of the DOM entirely rather than hidden in
   * CSS — one named prop at one call site instead of a role check in here.
   */
  showValue: boolean;
}

/**
 * What the salon actually sells, over the trend window.
 *
 * A real `<table>` rather than the Table primitive: this is tabular data, and
 * the primitive's fixed `--cols` track widths are set inline, so they can't be
 * narrowed by a media query — at phone widths its numeric columns left the
 * service name no room at all.
 */
export function TopServicesCard({ services, showValue }: TopServicesCardProps) {
  const { t, lang } = useI18n();
  const unpriced = services.reduce((sum, service) => sum + service.unpriced, 0);

  return (
    <Card className={styles.card}>
      <Eyebrow>{t("dashboard.topTitle")}</Eyebrow>
      <div className={styles.subtitle}>{t("dashboard.topSubtitle")}</div>

      {services.length === 0 ? (
        <p className={styles.empty}>{t("dashboard.topEmpty")}</p>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("dashboard.topColService")}</th>
                <th scope="col" className={styles.numeric}>
                  {t("dashboard.topColCount")}
                </th>
                {showValue && (
                  <th scope="col" className={styles.numeric}>
                    {t("dashboard.topColValue")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.serviceId}>
                  <td className={styles.name}>{service.serviceName}</td>
                  <td className={styles.numeric}>{service.count}</td>
                  {showValue && (
                    <td className={styles.numeric}>
                      {t("dashboard.topValueAmount", { amount: formatMinor(service.valueMinor, lang) })}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Expected, never collected: the site is reservation-only and clients
              pay in person, so the wording has to rule out reading this as takings. */}
          {showValue && <p className={styles.note}>{t("dashboard.topValueNote")}</p>}
          {showValue && unpriced > 0 && <p className={styles.note}>{t("dashboard.topUnpriced", { count: unpriced })}</p>}
        </>
      )}
    </Card>
  );
}
