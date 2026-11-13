import { useState } from "react";
import { useI18n } from "../i18n/I18nContext.js";
import { MOCK_PLANS, MOCK_SUBSCRIPTION, type Plan, type PlanId } from "../lib/subscriptionMock.js";
import { formatDateLabel, formatMonthLabel } from "../lib/tenantTime.js";
import { usePagination } from "../lib/usePagination.js";
import { AppShell } from "../components/AppShell.js";
import { ConfirmModal, type ConfirmRequest } from "../components/ConfirmModal.js";
import { PlanCard } from "../components/PlanCard.js";
import { Alert, Button, Card, Eyebrow, Icon, Pill, Pagination, Table, TableHead, TableRow } from "../components/ui/index.js";

const INVOICE_COLUMNS = "minmax(0,1.4fr) minmax(0,1fr) 110px";

/**
 * The owner's subscription: plan, SMS allowance, payment method, invoices.
 *
 * A PREVIEW ON MOCK DATA (lib/subscriptionMock.ts). Nothing here reaches an
 * API or a payment provider — switching plan only changes what this page
 * shows until it is reloaded — and the banner at the top says so.
 */
// Rows per page; a pager appears only once there are more.
const PAGE_SIZE = 12;

export function SubscriptionPage() {
  const { t, lang } = useI18n();
  const subscription = MOCK_SUBSCRIPTION;

  const [planId, setPlanId] = useState<PlanId>(subscription.planId);
  const [switched, setSwitched] = useState(false);
  // The question waiting on an answer, if any (see ConfirmModal).
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const pager = usePagination(subscription.invoices, PAGE_SIZE);

  const plan = MOCK_PLANS.find((candidate) => candidate.id === planId) ?? MOCK_PLANS[0];
  if (!plan) {
    return null;
  }
  const planName = t(`subscription.plan_${plan.id}`);
  const smsShare = Math.min(100, Math.round((subscription.smsUsed / plan.smsIncluded) * 100));

  function choose(next: Plan) {
    const name = t(`subscription.plan_${next.id}`);
    setConfirmRequest({
      title: t("subscription.switchTo", { plan: name }),
      message: t("subscription.confirmSwitch", { plan: name, price: next.price }),
      confirmLabel: t("subscription.switchTo", { plan: name }),
      run: () => {
        setPlanId(next.id);
        setSwitched(true);
      },
    });
  }

  return (
    <AppShell title={t("subscription.title")} subtitle={t("subscription.subtitle")}>
      <div className="flex max-w-5xl flex-col gap-4 xl:gap-5">
        <Alert variant="warning" flush>
          {t("subscription.previewNotice")}
        </Alert>
        {switched && (
          <Alert variant="success" flush>
            {t("subscription.switchedNotice", { plan: planName })}
          </Alert>
        )}

        <div className="grid items-start gap-4 md:grid-cols-2 xl:gap-5">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Eyebrow>{t("subscription.currentPlan")}</Eyebrow>
                <div className="mt-0.5 font-display text-2xl leading-tight font-bold">{planName}</div>
              </div>
              <Pill tone="success">{t("subscription.statusActive")}</Pill>
            </div>
            <p className="mt-3">
              <span className="font-display text-5xl leading-none font-bold tabular-nums">{plan.price} ₾</span>
              <span className="ml-1.5 text-sm text-base-content/60">{t("subscription.perMonth")}</span>
            </p>
            <p className="mt-3 text-sm text-base-content/60">
              {t("subscription.renewsOn", { date: formatDateLabel(subscription.renewsOn, lang) })}
            </p>
          </Card>

          <Card>
            <Eyebrow>{t("subscription.smsTitle")}</Eyebrow>
            <div className="mt-0.5 font-display text-2xl leading-tight font-bold tabular-nums">
              {t("subscription.smsUsed", { used: subscription.smsUsed, included: plan.smsIncluded })}
            </div>
            <progress
              className="progress progress-primary mt-4 h-2.5 rounded-none"
              value={smsShare}
              max={100}
              aria-label={t("subscription.smsUsed", { used: subscription.smsUsed, included: plan.smsIncluded })}
            />
            <p className="mt-3 text-sm text-base-content/60">
              {t("subscription.smsExtra", { price: subscription.extraSmsPrice })}
            </p>
          </Card>
        </div>

        <Card>
          <Eyebrow>{t("subscription.plansTitle")}</Eyebrow>
          <p className="mt-0.5 mb-4 text-sm text-base-content/60">{t("subscription.plansHint")}</p>
          <ul className="grid gap-3 md:grid-cols-3">
            {MOCK_PLANS.map((candidate) => (
              <li key={candidate.id}>
                <PlanCard plan={candidate} current={candidate.id === planId} onChoose={choose} />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1 basis-56">
              <Eyebrow>{t("subscription.paymentTitle")}</Eyebrow>
              <div className="mt-1 flex items-center gap-2 font-semibold">
                <Icon name="credit_card" />
                {t("subscription.cardLine", {
                  brand: subscription.card.brand,
                  last4: subscription.card.last4,
                  expires: subscription.card.expires,
                })}
              </div>
            </div>
            {/* No payment provider yet, so there is nowhere to send a new card. */}
            <Button variant="secondary" disabled title={t("subscription.notYet")}>
              {t("subscription.updateCard")}
            </Button>
          </div>
        </Card>

        <div>
          <Eyebrow className="mb-2">{t("subscription.invoicesTitle")}</Eyebrow>
          <Table>
            <TableHead columns={INVOICE_COLUMNS}>
              <div>{t("subscription.colPeriod")}</div>
              <div>{t("subscription.colAmount")}</div>
              <div>{t("subscription.colStatus")}</div>
            </TableHead>
            {pager.pageItems.map((invoice) => (
              <TableRow key={invoice.id} columns={INVOICE_COLUMNS}>
                <div className="font-semibold">{formatMonthLabel(invoice.period, lang)}</div>
                <div className="tabular-nums">{invoice.amount} ₾</div>
                <div>
                  <Pill tone="success">{t("subscription.invoicePaid")}</Pill>
                </div>
              </TableRow>
            ))}
          </Table>
            <Pagination {...pager} />
        </div>
      </div>

      {confirmRequest && <ConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} />}
    </AppShell>
  );
}
