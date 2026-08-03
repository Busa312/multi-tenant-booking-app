import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { BusinessHours, ProfessionalSummary, TimeOff } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
import {
  diffWeek,
  draftFromHours,
  hasChanges,
  invalidDays,
  WEEK_DAYS,
  type DayHours,
  type WeekDraft,
} from "../lib/weekSchedule.js";
import { useAuth } from "../auth/AuthContext.js";
import { useI18n } from "../i18n/I18nContext.js";
import { AppShell } from "../components/AppShell.js";
import { HoursScopePicker } from "../components/HoursScopePicker.js";
import { WeeklyScheduleEditor } from "../components/WeeklyScheduleEditor.js";
import { TimeOffCard } from "../components/TimeOffCard.js";
import { AddTimeOffModal } from "../components/AddTimeOffModal.js";
import { CardSkeleton } from "../components/CardSkeleton.js";
import { Alert } from "../components/ui/index.js";
import styles from "./Hours.module.css";

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
  const { role, professionalId: ownProfessionalId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Latches after a successful write and clears on the next edit, so the save
  // bar can distinguish "just saved" from "nothing to save".
  const [saved, setSaved] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  /**
   * The week being edited. Held here rather than in the row components so the
   * whole schedule submits as one change — nothing below writes to the server.
   * Null until the first load lands.
   */
  const [draft, setDraft] = useState<WeekDraft | null>(null);

  // A professional login only ever manages its own schedule (R20), so the URL
  // can't put it on someone else's.
  const locked = role === "professional";
  const scopeParam = searchParams.get("professionalId");
  const professionalId = locked ? ownProfessionalId : scopeParam;

  /**
   * `reseedDraft` is the whole reason this takes an argument. Time-off writes
   * reload the page's data too, and re-seeding on every load would silently
   * throw away schedule edits that hadn't been submitted yet — so only the
   * paths that genuinely invalidate the draft (first load, a saved week) ask
   * for it.
   */
  function load(reseedDraft = true) {
    return Promise.all([
      cachedApi.getTenant(),
      cachedApi.listBusinessHours(),
      cachedApi.listTimeOff(),
      cachedApi.listProfessionals(),
    ])
      .then(([tenant, hours, timeOff, professionals]) => {
        setData({ timezone: tenant.timezone, hours, timeOff, professionals });
        if (reseedDraft) setDraft(draftFromHours(hours, professionalId));
      })
      .catch(() => setError(t("hours.errLoad")));
  }

  // Fetch once on mount; a language switch shouldn't trigger a refetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), []);

  // Switching scope replaces the draft with that scope's stored week. Guarded
  // at the picker below, so anything unsaved has already been confirmed away.
  useEffect(() => {
    if (data) setDraft(draftFromHours(data.hours, professionalId));
    setSaved(false);
    // Deliberately not keyed on `data`: that would re-seed on every reload,
    // including the ones time-off writes trigger. See `load`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  const scopedProfessional = data?.professionals.find((p) => p.id === professionalId) ?? null;
  const scope = professionalId ? "professional" : "organisation";

  function professionalLabel(id: string | null): string {
    if (!id) return t("hours.scopeOrganisation");
    return data?.professionals.find((p) => p.id === id)?.name ?? t("hours.unknown");
  }

  const changes = useMemo(
    () => (data && draft ? diffWeek(draft, data.hours, professionalId) : null),
    [data, draft, professionalId],
  );
  const dirty = changes !== null && hasChanges(changes);
  const invalidCount = draft ? invalidDays(draft).length : 0;

  function changeDay(dayOfWeek: number, next: DayHours) {
    setSaved(false);
    setDraft((current) => (current ? { ...current, [dayOfWeek]: next } : current));
  }

  /** Spread one day's hours across every other day already open in this scope. */
  function copyToAll(startTime: string, endTime: string) {
    setSaved(false);
    setDraft((current) => {
      if (!current) return current;
      const next: WeekDraft = { ...current };
      for (const dayOfWeek of WEEK_DAYS) {
        // Only days already open: a copy spreads hours, it doesn't open the
        // salon on days that were closed.
        if (next[dayOfWeek]) next[dayOfWeek] = { startTime, endTime };
      }
      return next;
    });
  }

  function discard() {
    if (data) setDraft(draftFromHours(data.hours, professionalId));
    setError(null);
    setSaved(false);
  }

  async function saveWeek() {
    if (!changes || !dirty || invalidCount > 0 || saving) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      // Parallel, and safe to be: the API's upsert scopes its replace to
      // (tenant, professional, dayOfWeek), so two days never touch the same
      // rows and can't interleave. This is where the speed comes from — the
      // whole week costs one round trip's latency instead of one per day, and
      // one reload at the end instead of one after every keystroke's blur.
      await Promise.all([
        ...changes.upserts.map((day) =>
          cachedApi.upsertBusinessHours({ professionalId: professionalId ?? undefined, ...day }),
        ),
        ...changes.deletes.map((row) => cachedApi.deleteBusinessHours(row.id)),
      ]);
      await load();
      setSaved(true);
    } catch {
      // The draft is left exactly as it was, so a failed save is retryable
      // rather than something the user has to retype.
      setError(t("hours.errSaveWeek"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTimeOff(block: TimeOff) {
    if (!window.confirm(t("hours.confirmDeleteTimeOff"))) return;
    setError(null);
    setDeletingId(block.id);
    try {
      await cachedApi.deleteTimeOff(block.id);
      // Keeps the schedule draft: this write has nothing to do with it.
      await load(false);
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
      subtitle={scopedProfessional ? t("hours.subtitleScoped", { name: scopedProfessional.name }) : t("hours.subtitle")}
    >
      <div className={`fade-up ${styles.grid}`}>
        {error && <Alert className={styles.errorFull}>{error}</Alert>}

        {!locked && data && (
          <div className={styles.scope}>
            <HoursScopePicker
              professionals={data.professionals}
              value={professionalId}
              onChange={(next) => {
                // The draft is per-scope, so switching away drops it. Ask first
                // — silently discarding a week someone just laid out would be
                // the worst failure mode this change introduces.
                if (dirty && !window.confirm(t("hours.confirmDiscard"))) return;
                setError(null);
                setSearchParams(next ? { professionalId: next } : {}, { replace: true });
              }}
            />
          </div>
        )}

        <div className={styles.week}>
          {data && draft ? (
            <WeeklyScheduleEditor
              scope={scope}
              professionalName={scopedProfessional?.name ?? null}
              draft={draft}
              hours={data.hours}
              saving={saving}
              dirty={dirty}
              invalidCount={invalidCount}
              saved={saved}
              onChangeDay={changeDay}
              onCopyToAll={copyToAll}
              onSubmit={saveWeek}
              onDiscard={discard}
            />
          ) : (
            <CardSkeleton rows={7} rowHeight={DAY_ROW} />
          )}
        </div>

        <div className={styles.timeOff}>
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

      {addOpen && data && (
        <AddTimeOffModal
          professionals={data.professionals}
          timezone={data.timezone}
          defaultProfessionalId={professionalId}
          locked={locked}
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            void load(false);
          }}
        />
      )}
    </AppShell>
  );
}
