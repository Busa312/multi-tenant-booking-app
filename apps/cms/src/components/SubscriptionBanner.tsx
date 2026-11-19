import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import type { SubscriptionOverview } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { cachedApi } from "../lib/cache.js";
import { formatInstantDate } from "../lib/tenantTime.js";
import { Alert, ButtonLink } from "./ui/index.js";

// The trial warning appears this close to its end.
const TRIAL_WARNING_MS = 3 * 24 * 60 * 60_000;

/**
 * R480/R490: tells the owner, on every page, when the trial is about to end, a
 * payment is due, or booking is paused — with the way to the subscription page.
 * (Texts are unlimited, R500, so there is nothing to warn about there.)
 * Rendered for owners only (AppShell), and not on that page itself.
 */
export function SubscriptionBanner() {
  const { t, lang } = useI18n();
  const { pathname } = useLocation();
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([cachedApi.getSubscriptionCached(), cachedApi.getTenant()])
      .then(([next, tenant]) => {
        if (!live) return;
        setOverview(next);
        setTimezone(tenant.timezone);
      })
      .catch(() => undefined);
    const stop = cachedApi.onSubscriptionChange(setOverview);
    return () => {
      live = false;
      stop();
    };
  }, []);

  if (!overview || !timezone || pathname.startsWith("/settings/subscription")) return null;
  const date = (iso: string) => formatInstantDate(iso, timezone, lang);

  let message: string | null = null;
  let variant: "warning" | "error" = "warning";
  if (!overview.billingAvailable) {
    // Nothing can be paid on this server, so nothing is paused either (R490).
    return null;
  }
  if (overview.bookingPaused) {
    message = t("subscription.bannerLapsed");
    variant = "error";
  } else if (overview.status === "past_due" && overview.graceEndsAt) {
    message = t("subscription.bannerPastDue", { date: date(overview.graceEndsAt) });
  } else if (overview.status === "trial" && new Date(overview.trialEndsAt).getTime() - Date.now() < TRIAL_WARNING_MS) {
    message = t("subscription.bannerTrial", { date: date(overview.trialEndsAt) });
  }
  if (!message) return null;

  return (
    <Alert variant={variant}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>{message}</span>
        <ButtonLink to="/settings/subscription" size="sm" variant="secondary">
          {t("subscription.bannerAction")}
        </ButtonLink>
      </div>
    </Alert>
  );
}
