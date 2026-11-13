import type { NoShowHistory } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { Pill } from "./ui/index.js";

interface NoShowBadgeProps {
  history: NoShowHistory | null;
  className?: string;
}

// The API looks at this many of the customer's latest finished visits.
const FULL_RECORD = 3;

/**
 * R360: flags a booking whose customer missed recent visits, wherever that
 * booking is shown. Red only for the full record — three finished visits, none
 * attended; anything less is amber. Renders nothing for a customer with no
 * history or a clean one: new and reliable customers are never marked.
 */
export function NoShowBadge({ history, className }: NoShowBadgeProps) {
  const { t } = useI18n();

  if (!history || history.missed === 0) {
    return null;
  }

  if (history.missed === FULL_RECORD) {
    return (
      <Pill tone="danger" className={className}>
        {t("bookings.noShowAll", { count: history.missed })}
      </Pill>
    );
  }

  return (
    <Pill tone="warning" className={className}>
      {history.of === 1 ? t("bookings.noShowOnly") : t("bookings.noShowSome", { missed: history.missed, of: history.of })}
    </Pill>
  );
}
