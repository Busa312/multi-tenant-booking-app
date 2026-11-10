import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { formatMinor, type TopServiceStat } from "../lib/dashboardStats.js";
import { Card, Eyebrow } from "./ui/index.js";

interface TopServicesCardProps {
  services: TopServiceStat[];
  /**
   * Owner only. A `professional` login has no access to pricing, so the value
   * column and its note are left out of the DOM entirely rather than hidden in
   * CSS — one named prop at one call site instead of a role check in here.
   */
  showValue: boolean;
}

// Numeric columns keep a fixed width and the header words wrap rather than set
// it; the service name is the column that gives (and ellipsizes).
const NUMERIC = "w-[4.25rem] text-right tabular-nums [overflow-wrap:anywhere] sm:w-[5.5rem]";
const TH = "pt-0 pb-2.5 text-left text-[11px] font-bold tracking-wider text-base-content/55 uppercase";
const TD = "border-t border-base-300 py-2.5";

/**
 * What the salon actually sells, over the trend window. A real `<table>` with
 * fixed layout, so a long service name can't push the numbers out of the card.
 */
export function TopServicesCard({ services, showValue }: TopServicesCardProps) {
  const { t, lang } = useI18n();
  const nameOf = useLocalizedName();
  const unpriced = services.reduce((sum, service) => sum + service.unpriced, 0);

  return (
    <Card>
      <Eyebrow>{t("dashboard.topTitle")}</Eyebrow>
      <div className="mt-0.5 font-display text-lg font-semibold">{t("dashboard.topSubtitle")}</div>

      {services.length === 0 ? (
        <p className="mt-4 text-base-content/60">{t("dashboard.topEmpty")}</p>
      ) : (
        <>
          <table className="mt-4 w-full table-fixed border-collapse text-[13px] sm:text-[13.5px]">
            <thead>
              <tr>
                <th scope="col" className={TH}>
                  {t("dashboard.topColService")}
                </th>
                <th scope="col" className={`${TH} ${NUMERIC}`}>
                  {t("dashboard.topColCount")}
                </th>
                {showValue && (
                  <th scope="col" className={`${TH} ${NUMERIC}`}>
                    {t("dashboard.topColValue")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {services.map((service, index) => (
                <tr key={service.serviceId}>
                  <td className={`${TD} truncate font-semibold`}>
                    <span className="mr-2 inline-grid size-5 place-items-center rounded-full bg-base-200 text-[10px] font-bold text-base-content/60">
                      {index + 1}
                    </span>
                    {nameOf(service.serviceName, service.serviceNameI18n)}
                  </td>
                  <td className={`${TD} ${NUMERIC}`}>{service.count}</td>
                  {showValue && (
                    <td className={`${TD} ${NUMERIC}`}>
                      {t("dashboard.topValueAmount", { amount: formatMinor(service.valueMinor, lang) })}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Expected, never collected: the site is reservation-only and clients
              pay in person, so the wording has to rule out reading this as takings. */}
          {showValue && <p className="mt-3 text-xs leading-relaxed text-base-content/55">{t("dashboard.topValueNote")}</p>}
          {showValue && unpriced > 0 && (
            <p className="mt-1.5 text-xs leading-relaxed text-base-content/55">
              {t("dashboard.topUnpriced", { count: unpriced })}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
