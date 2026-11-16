import { useEffect, useMemo, useRef, useState } from "react";
import type { BusinessHours } from "@booking/shared-types";
import { cachedApi } from "./cache.js";
import {
  diffWeek,
  draftFromHours,
  hasChanges,
  invalidDays,
  WEEK_DAYS,
  windowOf,
  type DayHours,
  type WeekDraft,
} from "./weekSchedule.js";

export type SaveOutcome = "saved" | "skipped" | "failed";

export interface WeekScheduleDraft {
  /** The week being edited; null until the stored hours have loaded. */
  draft: WeekDraft | null;
  dirty: boolean;
  /** Days whose window is incomplete or ends before it starts. */
  invalidCount: number;
  saving: boolean;
  /** Latches after a successful save and clears on the next edit. */
  saved: boolean;
  changeDay: (dayOfWeek: number, next: DayHours) => void;
  /** Spreads one day's hours across every other day already open. */
  copyToAll: (startTime: string, endTime: string) => void;
  discard: () => void;
  /** Replaces the draft with what's stored (after a save, or a deliberate reload). */
  reseed: (hours: BusinessHours[]) => void;
  /** Replaces the draft outright — e.g. a suggested week for a salon that has none. */
  replace: (draft: WeekDraft) => void;
  /**
   * Writes the week. `reload` fetches the stored hours afterwards, which the
   * draft is re-seeded from. "failed": the draft is left exactly as it was, so
   * the save can simply be retried. "skipped": nothing was written — nothing
   * changed, some day is invalid, or a save is already running.
   */
  save: (reload: () => Promise<BusinessHours[] | null>) => Promise<SaveOutcome>;
}

/**
 * A week of business hours held as one edit and saved as one change — shared
 * by the Hours page and the guided setup (R420), so both write hours the same
 * way.
 *
 * The draft is seeded once, when the stored hours first arrive, and again when
 * the scope (`professionalId`) changes. It is deliberately *not* re-seeded every
 * time `hours` changes: other writes on the same page (time off) reload the
 * hours too, and re-seeding then would silently throw away unsaved edits.
 */
export function useWeekScheduleDraft(hours: BusinessHours[] | null, professionalId: string | null): WeekScheduleDraft {
  const [draft, setDraft] = useState<WeekDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const latestHours = useRef(hours);
  latestHours.current = hours;

  useEffect(() => {
    if (draft === null && hours) setDraft(draftFromHours(hours, professionalId));
    // Only the first arrival seeds; see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours]);

  useEffect(() => {
    if (latestHours.current) setDraft(draftFromHours(latestHours.current, professionalId));
    setSaved(false);
  }, [professionalId]);

  const changes = useMemo(
    () => (hours && draft ? diffWeek(draft, hours, professionalId) : null),
    [hours, draft, professionalId],
  );
  const dirty = changes !== null && hasChanges(changes);
  const invalidCount = draft ? invalidDays(draft).length : 0;

  function reseed(fromHours: BusinessHours[]) {
    setDraft(draftFromHours(fromHours, professionalId));
    setSaved(false);
  }

  return {
    draft,
    dirty,
    invalidCount,
    saving,
    saved,
    changeDay: (dayOfWeek, next) => {
      setSaved(false);
      setDraft((current) => (current ? { ...current, [dayOfWeek]: next } : current));
    },
    copyToAll: (startTime, endTime) => {
      setSaved(false);
      setDraft((current) => {
        if (!current) return current;
        const next: WeekDraft = { ...current };
        for (const dayOfWeek of WEEK_DAYS) {
          // Only days already open: a copy spreads hours, it doesn't open the
          // salon on days that were closed (or end someone's day off).
          if (windowOf(next[dayOfWeek] ?? null)) next[dayOfWeek] = { startTime, endTime };
        }
        return next;
      });
    },
    discard: () => {
      if (latestHours.current) reseed(latestHours.current);
    },
    reseed,
    replace: (next) => {
      setSaved(false);
      setDraft(next);
    },
    save: async (reload) => {
      if (!changes || !dirty || invalidCount > 0 || saving) return "skipped";
      setSaved(false);
      setSaving(true);
      try {
        // Parallel, and safe to be: the API's upsert scopes its replace to
        // (tenant, professional, dayOfWeek), so two days never touch the same
        // rows. The whole week costs one round trip's latency.
        await Promise.all([
          ...changes.upserts.map((day) =>
            cachedApi.upsertBusinessHours({ professionalId: professionalId ?? undefined, ...day }),
          ),
          ...changes.deletes.map((row) => cachedApi.deleteBusinessHours(row.id)),
        ]);
        const fresh = await reload();
        if (fresh) reseed(fresh);
        setSaved(true);
        return "saved";
      } catch {
        return "failed";
      } finally {
        setSaving(false);
      }
    },
  };
}
