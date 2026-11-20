import { planName, type SubscriptionPaymentStatus, type SubscriptionPaymentSummary } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { formatInstantDate } from "../lib/tenantTime.js";
import { usePagination } from "../lib/usePagination.js";
import { Eyebrow, Pagination, Pill, Table, TableEmpty, TableHead, TableRow, type PillTone } from "./ui/index.js";

interface SubscriptionInvoicesProps {
  payments: SubscriptionPaymentSummary[];
  timezone: string;
}

const COLUMNS = "minmax(0,0.9fr) minmax(0,1.6fr) 90px 120px";
// Rows per page; a pager appears only once there are more.
const PAGE_SIZE = 12;

const STATUS: Record<SubscriptionPaymentStatus, { key: string; tone: PillTone }> = {
  approved: { key: "subscription.invoicePaid", tone: "success" },
  pending: { key: "subscription.invoicePending", tone: "neutral" },
  declined: { key: "subscription.invoiceDeclined", tone: "danger" },
  expired: { key: "subscription.invoiceExpired", tone: "warning" },
};

const REFUNDED = { key: "subscription.invoiceRefunded", tone: "neutral" as PillTone };

/** R470: every payment attempt, newest first, with what it paid for and how it went. */
export function SubscriptionInvoices({ payments, timezone }: SubscriptionInvoicesProps) {
  const { t, lang } = useI18n();
  const pager = usePagination(payments, PAGE_SIZE);
  const date = (iso: string) => formatInstantDate(iso, timezone, lang);

  return (
    <div>
      <Eyebrow className="mb-2">{t("subscription.invoicesTitle")}</Eyebrow>
      {/* Scrolls sideways on a phone rather than squeezing four columns, as the other tables do. */}
      <div className="overflow-x-auto">
      <Table className="min-w-[560px]">
        <TableHead columns={COLUMNS}>
          <div>{t("subscription.colDate")}</div>
          <div>{t("subscription.colItem")}</div>
          <div>{t("subscription.colAmount")}</div>
          <div>{t("subscription.colStatus")}</div>
        </TableHead>
        {pager.pageItems.map((payment) => {
          // A card check is refunded the moment it's approved.
          const status = payment.kind === "card" && payment.status === "approved" ? REFUNDED : STATUS[payment.status];
          return (
            <TableRow key={payment.id} columns={COLUMNS}>
              <div className="tabular-nums">{date(payment.createdAt)}</div>
              <div className="min-w-0">
                <div className="font-semibold">
                  {payment.kind === "card" || !payment.plan
                    ? t("subscription.itemCard")
                    : t("subscription.itemPlan", { plan: planName(payment.plan, lang) })}
                </div>
                {payment.periodStart && payment.periodEnd && payment.status === "approved" && (
                  <div className="text-xs text-base-content/60 tabular-nums">
                    {date(payment.periodStart)} – {date(payment.periodEnd)}
                  </div>
                )}
                {payment.failureReason && <div className="text-xs text-error">{payment.failureReason}</div>}
              </div>
              <div className="tabular-nums">{payment.amount} ₾</div>
              <div>
                <Pill tone={status.tone}>{t(status.key)}</Pill>
              </div>
            </TableRow>
          );
        })}
        {payments.length === 0 && <TableEmpty>{t("subscription.invoicesEmpty")}</TableEmpty>}
      </Table>
      </div>
      <Pagination {...pager} />
    </div>
  );
}
