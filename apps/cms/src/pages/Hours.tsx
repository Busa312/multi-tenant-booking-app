import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { BusinessHours, ProfessionalSummary, TimeOff } from "@booking/shared-types";
import { cachedApi } from "../lib/cache.js";
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
  const [savingDay, setSavingDay] = useState<number | null>(null);
  // A copy touches every open day, so it locks the whole week rather than a row.
  const [copying, setCopying] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // A professional login only ever manages its own schedule (R20), so the URL
  // can't put it on someone else's.
  const locked = role === "professional";
  const scopeParam = searchParams.get("professionalId");
  const professionalId = locked ? ownProfessionalId : scopeParam;

  function load() {
    return Promise.all([
      cachedApi.getTenant(),
      cachedApi.listBusinessHours(),
      cachedApi.listTimeOff(),
      cachedApi.listProfessionals(),
    ])
      .then(([tenant, hours, timeOff, professionals]) => {
        setData({ timezone: tenant.timezone, hours, timeOff, professionals });
      })
      .catch(() => setError(t("hours.errLoad")));
  }

  // Fetch once on mount; a language switch shouldn't trigger a refetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), []);

  const scopedProfessional = data?.professionals.find((p) => p.id === professionalId) ?? null;
  const scope = professionalId ? "professional" : "organisation";

  function professionalLabel(id: string | null): string {
    if (!id) return t("hours.scopeOrganisation");
    return data?.professionals.find((p) => p.id === id)?.name ?? t("hours.unknown");
  }

  async function saveDay(dayOfWeek: number, startTime: string, endTime: string) {
    setError(null);
    setSavingDay(dayOfWeek);
    try {
      await cachedApi.upsertBusinessHours({
        professionalId: professionalId ?? undefined,
        dayOfWeek,
        startTime,
        endTime,
      });
      await load();
    } catch {
      setError(t("hours.errSaveDay"));
    } finally {
      setSavingDay(null);
    }
  }

  async function clearDay(row: BusinessHours) {
    setError(null);
    setSavingDay(row.dayOfWeek);
    try {
      await cachedApi.deleteBusinessHours(row.id);
      await load();
    } catch {
      setError(t("hours.errSaveDay"));
    } finally {
      setSavingDay(null);
    }
  }

  /** Spread one day's hours across every other day already open in this scope. */
  async function copyToAll(startTime: string, endTime: string) {
    if (!data || copying) return;
    const openDays = data.hours
      .filter((row) => row.professionalId === professionalId)
      .map((row) => row.dayOfWeek);
    setError(null);
    setCopying(true);
    try {
      // Sequential, not Promise.all: each write deletes the day's existing row
      // before inserting, and firing seven of those at once against the same
      // scope invites the interleaving the per-day replace is meant to prevent.
      for (const dayOfWeek of openDays) {
        await cachedApi.upsertBusinessHours({
          professionalId: professionalId ?? undefined,
          dayOfWeek,
          startTime,
          endTime,
        });
      }
      await load();
    } catch {
      setError(t("hours.errSaveDay"));
    } finally {
      setCopying(false);
    }
  }

  async function deleteTimeOff(block: TimeOff) {
    if (!window.confirm(t("hours.confirmDeleteTimeOff"))) return;
    setError(null);
    setDeletingId(block.id);
    try {
      await cachedApi.deleteTimeOff(block.id);
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
                setError(null);
                setSearchParams(next ? { professionalId: next } : {}, { replace: true });
              }}
            />
          </div>
        )}

        <div className={styles.week}>
          {data ? (
            <WeeklyScheduleEditor
              scope={scope}
              professionalName={scopedProfessional?.name ?? null}
              hours={data.hours}
              professionalId={professionalId}
              savingDay={savingDay}
              busy={copying}
              onSave={saveDay}
              onClear={clearDay}
              onCopyToAll={copyToAll}
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
            void load();
          }}
        />
      )}
    </AppShell>
  );
}
