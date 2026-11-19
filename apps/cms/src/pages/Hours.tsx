import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { BusinessHours, ProfessionalSummary, TimeOff } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import { useWeekScheduleDraft } from "../lib/useWeekScheduleDraft.js";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import { useLocalizedName } from "../lib/useLocalizedName.js";
import { ConfirmModal, type ConfirmRequest } from "../components/ConfirmModal.js";
import { AppShell } from "../components/AppShell.js";
import { HoursScopePicker } from "../components/HoursScopePicker.js";
import { WeeklyScheduleEditor } from "../components/WeeklyScheduleEditor.js";
import { TimeOffCard } from "../components/TimeOffCard.js";
import { BookingPoliciesCard } from "../components/BookingPoliciesCard.js";
import { AddTimeOffModal } from "../components/AddTimeOffModal.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
import { Alert } from "../components/ui/index.js";

/**
 * Placeholder row heights. A ScheduleDayRow is a label, two time inputs and an
 * action on one line (10px padding, 13px at the wrapping breakpoint); a time-off
 * block is a two-line entry. The week always has exactly seven rows, which
 * makes that slot's reservation exact rather than typical.
 */
const DAY_ROW = "46px";
const TIME_OFF_ROW = "52px";

interface PageData {
  timezone: string;
  hours: BusinessHours[];
  timeOff: TimeOff[];
  professionals: ProfessionalSummary[];
}

/**
 * When the salon — or one person in it — is open for business.
 *
 * The week is edited in place rather than assembled one row at a time, and a
 * professional's page shows the organisation's hours on the days they haven't
 * overridden, because that inheritance is what the availability engine applies
 * (`AvailabilityService.windowsFor`) and it used to be invisible here.
 */
export function HoursPage() {
  const { t } = useI18n();
  // The question waiting on an answer, if any (see ConfirmModal).
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const nameOf = useLocalizedName();
  const { role, professionalId: ownProfessionalId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // A professional login only ever manages its own schedule (R20), so the URL
  // can't put it on someone else's.
  const locked = role === "professional";
  const scopeParam = searchParams.get("professionalId");
  const professionalId = locked ? ownProfessionalId : scopeParam;

  /**
   * The week being edited, held here rather than in the row components so the
   * whole schedule submits as one change — nothing below writes to the server.
   * Seeded when the hours first load and when the scope changes, never on the
   * reloads time-off writes cause (see useWeekScheduleDraft).
   */
  const schedule = useWeekScheduleDraft(data?.hours ?? null, professionalId);
  const { draft, dirty, invalidCount, saving, saved } = schedule;

  /** Fetches everything the page shows, and hands back the fresh data (null if it failed). */
  function load(): Promise<PageData | null> {
    return Promise.all([
      cachedApi.getTenant(),
      cachedApi.listBusinessHours(),
      cachedApi.listTimeOff(),
      cachedApi.listProfessionals(),
    ])
      .then(([tenant, hours, timeOff, professionals]) => {
        const next = { timezone: tenant.timezone, hours, timeOff, professionals };
        setData(next);
        return next;
      })
      .catch(() => {
        setError(t("hours.errLoad"));
        return null;
      });
  }

  // Fetch once on mount; a language switch shouldn't trigger a refetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), []);

  const scopedProfessional = data?.professionals.find((p) => p.id === professionalId) ?? null;
  const scope = professionalId ? "professional" : "organisation";

  function professionalLabel(id: string | null): string {
    if (!id) return t("hours.scopeOrganisation");
    const professional = data?.professionals.find((p) => p.id === id);
    return professional ? nameOf(professional.name, professional.nameI18n) : t("hours.unknown");
  }

  async function saveWeek() {
    setError(null);
    // The hook re-seeds the draft from the reload; a failed save leaves the
    // draft as it was, so it is retryable rather than something to retype.
    const outcome = await schedule.save(async () => (await load())?.hours ?? null);
    if (outcome === "failed") setError(t("hours.errSaveWeek"));
  }

  function discard() {
    schedule.discard();
    setError(null);
  }

  function deleteTimeOff(block: TimeOff) {
    setConfirmRequest({
      title: t("hours.deleteTimeOff"),
      message: t("hours.confirmDeleteTimeOff"),
      confirmLabel: t("hours.deleteTimeOff"),
      danger: true,
      run: () => void deleteTimeOffConfirmed(block),
    });
  }

  async function deleteTimeOffConfirmed(block: TimeOff) {
    setError(null);
    setDeletingId(block.id);
    try {
      await cachedApi.deleteTimeOff(block.id);
      // Leaves the schedule draft alone: this write has nothing to do with it.
      await load();
    } catch {
      setError(t("hours.errSaveTimeOff"));
    } finally {
      setDeletingId(null);
    }
  }

  // Time off is additive rather than an override: a tenant-wide block and a
  // professional's own both apply, so a scoped view lists both.
  const visibleTimeOff =
    data && professionalId
      ? data.timeOff.filter((block) => block.professionalId === professionalId || block.professionalId === null)
      : (data?.timeOff ?? []);

  return (
    <AppShell
      title={t("hours.title")}
      subtitle={scopedProfessional ? t("hours.subtitleScoped", { name: nameOf(scopedProfessional.name, scopedProfessional.nameI18n) }) : t("hours.subtitle")}
    >
      <div className="grid max-w-4xl items-start gap-4 2xl:max-w-none 2xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] 2xl:gap-5">
        {error && <Alert flush className="2xl:col-span-2">{error}</Alert>}

        {/* Mounted before the data arrives (just "whole organisation" until then),
            so the cards below don't jump down when it does. */}
        {!locked && (
          <div className="2xl:col-span-2">
            <HoursScopePicker
              professionals={data?.professionals ?? []}
              value={professionalId}
              onChange={(next) => {
                // The draft is per-scope, so switching away drops it. Ask first
                // — silently discarding a week someone just laid out would be
                // the worst failure mode this change introduces.
                const switchScope = () => {
                  setError(null);
                  setSearchParams(next ? { professionalId: next } : {}, { replace: true });
                };
                if (!dirty) {
                  switchScope();
                  return;
                }
                setConfirmRequest({
                  title: t("hours.discardChanges"),
                  message: t("hours.confirmDiscard"),
                  confirmLabel: t("hours.discardChanges"),
                  danger: true,
                  run: switchScope,
                });
              }}
            />
          </div>
        )}

        <div>
          {data && draft ? (
            <WeeklyScheduleEditor
              scope={scope}
              professionalName={scopedProfessional ? nameOf(scopedProfessional.name, scopedProfessional.nameI18n) : null}
              draft={draft}
              hours={data.hours}
              saving={saving}
              dirty={dirty}
              invalidCount={invalidCount}
              saved={saved}
              onChangeDay={schedule.changeDay}
              onCopyToAll={schedule.copyToAll}
              onSubmit={saveWeek}
              onDiscard={discard}
            />
          ) : (
            <CardSkeleton rows={7} rowHeight={DAY_ROW} />
          )}
        </div>

        <div>
          {data ? (
            <TimeOffCard
              blocks={visibleTimeOff}
              timezone={data.timezone}
              labelFor={professionalLabel}
              busyId={deletingId}
              onAdd={() => setAddOpen(true)}
              onDelete={deleteTimeOff}
            />
          ) : (
            <CardSkeleton rows={3} rowHeight={TIME_OFF_ROW} />
          )}
        </div>
      </div>

      {/* R220: an organisation-wide booking rule, so only in organisation scope */}
      {!locked && !professionalId && (
        <div className="mt-4 max-w-4xl 2xl:mt-5 2xl:max-w-none">
          <BookingPoliciesCard />
        </div>
      )}

      {addOpen && data && (
        <AddTimeOffModal
          professionals={data.professionals}
          timezone={data.timezone}
          defaultProfessionalId={professionalId}
          locked={locked}
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            void load();
          }}
        />
      )}
      {confirmRequest && <ConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} />}
    </AppShell>
  );
}
