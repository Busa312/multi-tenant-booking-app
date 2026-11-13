import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { enabledLocalesOf } from "@booking/shared-types";
import type {
  BusinessHours,
  LocationSummary,
  OnboardingStatus,
  OnboardingStepId,
  ProfessionalSummary,
  ServiceSummary,
} from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useI18n } from "../i18n/I18nContext.js";
import { publicSiteUrl } from "../lib/publicSiteUrl.js";
import { currentSetupStep, doneCount, markSetupOpened, nextSetupStep } from "../lib/setupSteps.js";
import { AppShell } from "../components/AppShell.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
import { SetupStepList } from "../components/SetupStepList.js";
import { SetupStepFooter } from "../components/SetupStepFooter.js";
import { SetupStepLocations } from "../components/SetupStepLocations.js";
import { SetupStepHours } from "../components/SetupStepHours.js";
import { SetupStepServices } from "../components/SetupStepServices.js";
import { SetupStepTeam } from "../components/SetupStepTeam.js";
import { SetupStepSite } from "../components/SetupStepSite.js";
import { SetupStepLive } from "../components/SetupStepLive.js";
import { Alert, Button, Card } from "../components/ui/index.js";

interface SetupData {
  status: OnboardingStatus;
  locales: string[];
  siteUrl: string | null;
  locations: LocationSummary[];
  hours: BusinessHours[];
  services: ServiceSummary[];
  professionals: ProfessionalSummary[];
}

/**
 * R420: the owner's guided setup — locations, opening hours, services, team,
 * booking site, going live. Each step reuses the form the rest of the CMS
 * uses, and every step can be skipped and reopened. What counts as done comes
 * from the API, which reads it from the salon's data.
 */
export function SetupPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<SetupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    return Promise.all([
      cachedApi.getOnboarding(),
      cachedApi.getTenant(),
      cachedApi.listLocations(),
      cachedApi.listBusinessHours(),
      cachedApi.listServices(),
      cachedApi.listProfessionals(),
    ])
      .then(([status, tenant, locations, hours, services, professionals]) =>
        setData({
          status,
          locales: enabledLocalesOf(tenant.configJson.enabledLocales),
          siteUrl: publicSiteUrl(tenant.subdomain),
          locations,
          hours,
          services,
          professionals,
        }),
      )
      .catch(() => setError(t("setup.errLoad")));
  }

  useEffect(() => {
    // R420: it opens by itself only once a session.
    markSetupOpened();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = data ? currentSetupStep(data.status, searchParams.get("step")) : null;
  const step = data?.status.steps.find((candidate) => candidate.id === current) ?? null;

  const goTo = (id: OnboardingStepId) => setSearchParams({ step: id }, { replace: true });

  // Opened without a step (from the dashboard or the menu), the first open step
  // is picked — and then pinned in the URL. Otherwise adding the first location
  // or service would make the page jump on to the next step before the owner
  // could add a second one.
  useEffect(() => {
    if (current && !searchParams.get("step")) goTo(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  async function update(change: Parameters<typeof cachedApi.updateOnboarding>[0]) {
    setBusy(true);
    setError(null);
    try {
      const status = await cachedApi.updateOnboarding(change);
      setData((previous) => (previous ? { ...previous, status } : previous));
      return status;
    } catch {
      setError(t("common.somethingWrong"));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function skip(id: OnboardingStepId) {
    const status = await update({ skip: id });
    const next = status && nextSetupStep(status, id);
    if (next) goTo(next);
  }

  async function finish() {
    if (await update({ finished: true })) navigate("/");
  }

  function continueFrom(id: OnboardingStepId) {
    if (!data) return;
    const next = nextSetupStep(data.status, id);
    if (next) goTo(next);
  }

  const total = data?.status.steps.length ?? 0;

  return (
    <AppShell
      title={t("setup.title")}
      subtitle={data ? t("setup.progress", { done: doneCount(data.status), total }) : undefined}
    >
      <div className="grid max-w-5xl items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:gap-5">
        {error && <Alert flush className="lg:col-span-2">{error}</Alert>}

        {data && current && step ? (
          <>
            {/* min-w-0: on phones the step row scrolls inside the column instead of widening the page */}
            <nav className="min-w-0" aria-label={t("setup.stepsLabel")}>
              <SetupStepList status={data.status} current={current} onSelect={goTo} />
            </nav>

            <Card>
              <h2 className="font-display text-3xl leading-tight font-bold">{t(`setup.step_${current}`)}</h2>
              <div className="mt-2">
                {current === "locations" && (
                  <SetupStepLocations locations={data.locations} locales={data.locales} onChanged={() => void load()} />
                )}
                {current === "hours" && <SetupStepHours hours={data.hours} onSaved={() => void load()} />}
                {current === "services" && (
                  <SetupStepServices
                    services={data.services}
                    professionals={data.professionals}
                    locales={data.locales}
                    onChanged={() => void load()}
                  />
                )}
                {current === "team" && (
                  <SetupStepTeam
                    professionals={data.professionals}
                    services={data.services}
                    // R150: only open branches can be newly assigned, as on the Professionals page
                    locations={data.locations.filter((location) => location.isActive)}
                    locales={data.locales}
                    onChanged={() => void load()}
                  />
                )}
                {current === "site" && <SetupStepSite siteUrl={data.siteUrl} />}
                {current === "live" && <SetupStepLive status={data.status} siteUrl={data.siteUrl} />}
              </div>

              <SetupStepFooter
                done={step.done}
                skipped={step.skipped}
                skipLabel={
                  current === "locations"
                    ? t("setup.skipLocations")
                    : current === "site"
                      ? t("setup.skipSite")
                      : undefined
                }
                busy={busy}
                onSkip={() => void skip(current)}
                onContinue={() => continueFrom(current)}
                skippable={current !== "live"}
                primary={
                  current === "live" ? (
                    <Button icon="check" disabled={busy} onClick={() => void finish()}>
                      {t("setup.finish")}
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          </>
        ) : (
          !error && <CardSkeleton rows={6} rowHeight="44px" className="lg:col-span-2" />
        )}
      </div>
    </AppShell>
  );
}
