import { useEffect, useRef, useState } from "react";
import type { BusinessHours } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { cachedApi } from "../lib/cache.js";
import { useWeekScheduleDraft } from "../lib/useWeekScheduleDraft.js";
import type { WeekDraft } from "../lib/weekSchedule.js";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor.js";
import { Alert } from "./ui/index.js";

interface SetupStepHoursProps {
  hours: BusinessHours[];
  onSaved: () => void;
}

// A starting point for a salon with no hours yet: open Monday to Saturday.
const SUGGESTED: WeekDraft = {
  0: null,
  1: { startTime: "10:00", endTime: "19:00" },
  2: { startTime: "10:00", endTime: "19:00" },
  3: { startTime: "10:00", endTime: "19:00" },
  4: { startTime: "10:00", endTime: "19:00" },
  5: { startTime: "10:00", endTime: "19:00" },
  6: { startTime: "10:00", endTime: "19:00" },
};

/**
 * R420 step 2: when the salon is open. Without these hours nothing can be
 * booked, whatever services and staff exist — so this step says so. The same
 * editor and saving as the Hours page, organisation-wide only.
 */
export function SetupStepHours({ hours, onSaved }: SetupStepHoursProps) {
  const { t } = useI18n();
  const [stored, setStored] = useState(hours);
  const [error, setError] = useState<string | null>(null);
  const schedule = useWeekScheduleDraft(stored, null);
  const hasHours = stored.some((row) => row.professionalId === null);

  // Offer a full week to adjust, rather than seven closed days to open one by one.
  const suggested = useRef(false);
  useEffect(() => {
    if (suggested.current || !schedule.draft || hasHours) return;
    suggested.current = true;
    schedule.replace(SUGGESTED);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.draft, hasHours]);

  async function save() {
    setError(null);
    const outcome = await schedule.save(async () => {
      const fresh = await cachedApi.listBusinessHours();
      setStored(fresh);
      return fresh;
    });
    if (outcome === "saved") onSaved();
    if (outcome === "failed") setError(t("hours.errSaveWeek"));
  }

  return (
    <>
      <p className="text-base-content/70">{t("setup.hoursIntro")}</p>
      {!hasHours && (
        <Alert variant="warning" className="mt-3">
          {t("setup.hoursWarning")}
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}
      {schedule.draft && (
        <div className="mt-4">
          <WeeklyScheduleEditor
            scope="organisation"
            professionalName={null}
            draft={schedule.draft}
            hours={stored}
            saving={schedule.saving}
            dirty={schedule.dirty}
            invalidCount={schedule.invalidCount}
            saved={schedule.saved}
            onChangeDay={schedule.changeDay}
            onCopyToAll={schedule.copyToAll}
            onSubmit={() => void save()}
            onDiscard={schedule.discard}
          />
        </div>
      )}
    </>
  );
}
