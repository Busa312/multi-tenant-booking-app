import type { SubscriptionOverview } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { Button, Card, Eyebrow, Icon } from "./ui/index.js";

interface PaymentMethodCardProps {
  overview: SubscriptionOverview;
  busy: boolean;
  onUpdateCard: () => void;
}

/**
 * R470: the saved card, as Flitt masked it. Replacing it is a refunded 1 ₾
 * check on Flitt's page — the platform never sees a card number.
 */
export function PaymentMethodCard({ overview, busy, onUpdateCard }: PaymentMethodCardProps) {
  const { t } = useI18n();
  const canUpdate =
    overview.billingAvailable && overview.paidThrough !== null && (overview.status === "active" || overview.status === "past_due");

  return (
    <Card>
      <Eyebrow>{t("subscription.paymentTitle")}</Eyebrow>
      {overview.card ? (
        <div className="mt-1 flex items-center gap-2 font-semibold">
          <Icon name="credit_card" />
          <span className="min-w-0 break-all tabular-nums">
            {t("subscription.cardLine", { brand: overview.card.brand ?? "", masked: overview.card.masked })}
          </span>
        </div>
      ) : (
        <p className="mt-1 text-sm text-base-content/70">{t("subscription.noCard")}</p>
      )}
      {canUpdate && (
        <>
          <Button variant="secondary" className="mt-4" icon="credit_card" disabled={busy} onClick={onUpdateCard}>
            {t("subscription.updateCard")}
          </Button>
          <p className="mt-2 text-xs text-base-content/60">{t("subscription.updateCardHint")}</p>
        </>
      )}
    </Card>
  );
}
