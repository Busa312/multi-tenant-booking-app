import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { planName, type SubscriptionOverview, type SubscriptionPaymentSummary, type SubscriptionPlan } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { cachedApi } from "../lib/cache.js";
import { cx } from "../lib/cx.js";
import { formatInstantDate } from "../lib/tenantTime.js";
import { AppShell } from "../components/AppShell.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
import { ConfirmModal, type ConfirmRequest } from "../components/ConfirmModal.js";
import { PaymentMethodCard } from "../components/PaymentMethodCard.js";
import { PlanCard } from "../components/PlanCard.js";
import { SubscriptionInvoices } from "../components/SubscriptionInvoices.js";
import { SubscriptionStatusCard } from "../components/SubscriptionStatusCard.js";
import { Alert, Card, Eyebrow } from "../components/ui/index.js";

interface Notice {
  variant: "success" | "warning" | "error";
  text: string;
}

// After a return from Flitt, how often (and how many times) to ask again while the payment is still pending.
const CONFIRM_RETRY_MS = 3000;
const CONFIRM_TRIES = 6;

/**
 * The plans share the row evenly, whatever the admin offers (R550): one column
 * per plan where they fit side by side, two by two for four, stacked on phones.
 */
function planColumns(count: number): string {
  if (count <= 1) return "md:max-w-md";
  if (count === 2) return "md:grid-cols-2";
  if (count === 3) return "lg:grid-cols-3";
  return "md:grid-cols-2 2xl:grid-cols-4";
}

/**
 * The owner's subscription (R470–R490): where the salon stands, the plans, the
 * saved card and every payment. Paying happens on Flitt's page; coming back,
 * the page asks the API to confirm that payment (`?payment=<order id>`).
 */
export function SubscriptionPage() {
  const { t, lang } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [timezone, setTimezone] = useState("Asia/Tbilisi");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  // The question waiting on an answer, if any (see ConfirmModal).
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const returnedOrder = useRef(searchParams.get("payment"));
  // Set synchronously on the first click, before `busy` disables anything: a
  // double click must not open two payment pages (two orders) for one month.
  const leaving = useRef(false);

  function load() {
    return Promise.all([cachedApi.getSubscription(), cachedApi.getTenant()])
      .then(([next, tenant]) => {
        setOverview(next);
        setTimezone(tenant.timezone);
      })
      .catch(() => setError(t("subscription.errLoad")));
  }

  /** The payer is back from Flitt: confirm that order, asking again for a while if it's still pending. */
  async function confirmReturn(orderId: string) {
    for (let attempt = 0; attempt < CONFIRM_TRIES; attempt++) {
      try {
        const { payment, subscription } = await cachedApi.confirmSubscriptionPayment(orderId);
        setOverview(subscription);
        if (payment.status !== "pending") {
          setNotice(returnNotice(payment));
          return;
        }
        setNotice({ variant: "warning", text: t("subscription.returnPending") });
      } catch {
        setNotice({ variant: "warning", text: t("subscription.returnPending") });
      }
      await new Promise((resolve) => setTimeout(resolve, CONFIRM_RETRY_MS));
    }
  }

  function returnNotice(payment: SubscriptionPaymentSummary): Notice {
    if (payment.status === "approved") {
      return { variant: "success", text: t(payment.kind === "card" ? "subscription.returnCard" : "subscription.returnPaid") };
    }
    return {
      variant: "error",
      text: payment.failureReason
        ? t("subscription.returnFailedReason", { reason: payment.failureReason })
        : t("subscription.returnFailed"),
    };
  }

  useEffect(() => {
    const orderId = returnedOrder.current;
    // Taken once: React's development double-run of effects shouldn't confirm twice.
    returnedOrder.current = null;
    if (orderId) {
      // The order id has done its job; a reload shouldn't confirm it again.
      setSearchParams({}, { replace: true });
      void cachedApi.getTenant().then((tenant) => setTimezone(tenant.timezone)).catch(() => undefined);
      void confirmReturn(orderId);
    } else {
      void load();
    }
    // Once, on arrival; a language switch shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Off to Flitt's page. The button stays busy: this page is being left. */
  async function goToCheckout(start: () => Promise<{ checkoutUrl: string }>) {
    if (leaving.current) return;
    leaving.current = true;
    setError(null);
    setBusy(true);
    try {
      const { checkoutUrl } = await start();
      setNotice({ variant: "success", text: t("subscription.redirecting") });
      window.location.assign(checkoutUrl);
    } catch {
      setError(t("subscription.errCheckout"));
      setBusy(false);
      leaving.current = false;
    }
  }

  async function change(payload: Parameters<typeof cachedApi.updateSubscription>[0]) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      setOverview(await cachedApi.updateSubscription(payload));
    } catch {
      setError(t("subscription.errSave"));
    } finally {
      setBusy(false);
    }
  }

  const date = (iso: string) => formatInstantDate(iso, timezone, lang);
  const paying = overview !== null && overview.status === "active";

  /** R540: the salon has more open locations than this plan includes, so it can't be paid for or switched to. */
  function tooSmall(plan: SubscriptionPlan): boolean {
    return overview !== null && plan.maxLocations !== null && overview.activeLocations > plan.maxLocations;
  }

  function planNote(plan: SubscriptionPlan): string | null {
    if (!overview || overview.status === "free" || !tooSmall(plan)) return null;
    // The plan a paying salon renews on is already its own; nothing to choose there.
    if (paying && plan.id === (overview.nextPlanId ?? overview.planId)) return null;
    return t("subscription.planTooSmall", { count: overview.activeLocations, limit: plan.maxLocations ?? 0 });
  }

  function planAction(plan: SubscriptionPlan): { label: string; disabled: boolean; onClick: () => void } {
    const name = planName(plan, lang);
    if (!overview) return { label: name, disabled: true, onClick: () => undefined };
    if (overview.status === "free") return { label: name, disabled: true, onClick: () => undefined };

    if (paying && overview.paidThrough) {
      const paidThrough = overview.paidThrough;
      if (plan.id === overview.planId) {
        return overview.nextPlanId
          ? { label: t("subscription.keepPlanButton", { plan: name }), disabled: busy || tooSmall(plan), onClick: () => void change({ planId: plan.id }) }
          : { label: t("subscription.currentPlanButton"), disabled: true, onClick: () => undefined };
      }
      if (plan.id === overview.nextPlanId) return { label: t("subscription.nextBadge"), disabled: true, onClick: () => undefined };
      return {
        label: t("subscription.switchTo", { plan: name }),
        // A cancelled subscription has no next renewal to switch at; resuming comes first.
        disabled: busy || overview.cancelAtPeriodEnd || tooSmall(plan),
        onClick: () =>
          setConfirmRequest({
            title: t("subscription.switchTo", { plan: name }),
            message: t("subscription.confirmSwitch", { plan: name, price: Number(plan.price), date: date(paidThrough) }),
            confirmLabel: t("subscription.switchTo", { plan: name }),
            run: () => void change({ planId: plan.id }),
          }),
      };
    }

    return {
      label: t("subscription.payBtn", { plan: name, price: Number(plan.price) }),
      disabled: busy || !overview.billingAvailable || tooSmall(plan),
      onClick: () => void goToCheckout(() => cachedApi.startCheckout(plan.id, lang)),
    };
  }

  function planBadge(plan: SubscriptionPlan): string | null {
    if (!overview?.paidThrough || overview.status === "free") return null;
    if (plan.id === overview.planId) return t("subscription.currentBadge");
    if (plan.id === overview.nextPlanId) return t("subscription.nextBadge");
    return null;
  }

  return (
    <AppShell title={t("subscription.title")} subtitle={t("subscription.subtitle")}>
      <div className="flex max-w-5xl flex-col gap-4 xl:gap-5">
        {error && <Alert flush>{error}</Alert>}
        {notice && (
          <Alert variant={notice.variant} flush>
            {notice.text}
          </Alert>
        )}
        {overview && !overview.billingAvailable && overview.status !== "free" && (
          <Alert variant="warning" flush>
            {t("subscription.notConfigured")}
          </Alert>
        )}

        {overview ? (
          <>
            <div className="grid items-start gap-4 md:grid-cols-2 xl:gap-5">
              <SubscriptionStatusCard
                overview={overview}
                timezone={timezone}
                busy={busy}
                onCancel={() =>
                  setConfirmRequest({
                    title: t("subscription.cancelBtn"),
                    message: t("subscription.confirmCancel", { date: overview.paidThrough ? date(overview.paidThrough) : "" }),
                    confirmLabel: t("subscription.cancelBtn"),
                    danger: true,
                    run: () => void change({ cancelAtPeriodEnd: true }),
                  })
                }
                onResume={() => void change({ cancelAtPeriodEnd: false })}
              />
              <PaymentMethodCard
                overview={overview}
                busy={busy}
                onUpdateCard={() => void goToCheckout(() => cachedApi.startCardChange(lang))}
              />
            </div>

            {overview.status !== "free" && (
              <Card>
                <Eyebrow>{t("subscription.plansTitle")}</Eyebrow>
                <p className="mt-0.5 mb-4 text-sm text-base-content/60">
                  {t(paying ? "subscription.plansHintSwitch" : "subscription.plansHintPay")}
                </p>
                <ul className={cx("grid gap-3", planColumns(overview.plans.length))}>
                  {overview.plans.map((plan) => (
                    <li key={plan.id}>
                      <PlanCard
                        plan={plan}
                        current={overview.paidThrough !== null && plan.id === overview.planId}
                        badge={planBadge(plan)}
                        action={planAction(plan)}
                        note={planNote(plan)}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <SubscriptionInvoices payments={overview.payments} timezone={timezone} />
          </>
        ) : (
          !error && <CardSkeleton rows={4} rowHeight="44px" />
        )}
      </div>

      {confirmRequest && <ConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} />}
    </AppShell>
  );
}
