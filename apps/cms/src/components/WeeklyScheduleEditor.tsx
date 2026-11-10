import type { BusinessHours } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { dayOf, type DayHours, type WeekDraft } from "../lib/weekSchedule.js";
import { ScheduleDayRow, type ScheduleScope } from "./ScheduleDayRow.js";
import { ScheduleSaveBar } from "./ScheduleSaveBar.js";
import { Card, Eyebrow } from "./ui/index.js";
// The week's column tracks are declared next to the row that fills them, so the
// two can't drift apart — the rows subgrid onto whatever this defines.
import { WEEK_GRID } from "../lib/scheduleGridClasses.js";

interface WeeklyScheduleEditorProps {
  scope: ScheduleScope;
  /** Name of the professional being edited; drives the subtitle copy. */
  professionalName: string | null;
  /** The working draft for the scope being edited. */
  draft: WeekDraft;
  /** Every business-hours row for the tenant — the tenant-wide ones are what a professional inherits. */
  hours: BusinessHours[];
  saving: boolean;
  dirty: boolean;
  /** Days whose window is incomplete or ends before it starts. */
  invalidCount: number;
  saved: boolean;
  onChangeDay: (dayOfWeek: number, next: DayHours) => void;
  onCopyToAll: (startTime: string, endTime: string) => void;
  onSubmit: () => void;
  onDiscard: () => void;
}

/** Monday-first, the way a salon reads its week; `dayOfWeek` is Sunday-based. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * The whole week at once, edited as one draft and submitted as one change.
 *
 * Seven days are always visible, each showing the hours that will actually
 * apply. Nothing here writes: the page holds the draft and the save bar below
 * is the only thing that reaches the server.
 */
export function WeeklyScheduleEditor({
  scope,
  professionalName,
  draft,
  hours,
  saving,
  dirty,
  invalidCount,
  saved,
  onChangeDay,
  onCopyToAll,
  onSubmit,
  onDiscard,
}: WeeklyScheduleEditorProps) {
  const { t, messages } = useI18n();
  const dayLabels = messages.hours.days;

  const organisationRow = (dayOfWeek: number) =>
    hours.find((row) => row.dayOfWeek === dayOfWeek && row.professionalId === null) ?? null;

  return (
    <Card className="@container">
      <Eyebrow>{t("hours.weeklyTitle")}</Eyebrow>
      <p className="mt-1 text-[13px] leading-relaxed text-base-content/60">
        {scope === "organisation"
          ? t("hours.weeklySubtitleOrg")
          : t("hours.weeklySubtitlePro", { name: professionalName ?? "" })}
      </p>

      <div className={`mt-2.5 ${WEEK_GRID}`}>
        {WEEK_ORDER.map((dayOfWeek) => (
          <ScheduleDayRow
            key={dayOfWeek}
            // noUncheckedIndexedAccess: the catalog array is typed as string[].
            dayLabel={dayLabels[dayOfWeek] ?? String(dayOfWeek)}
            scope={scope}
            value={dayOf(draft, dayOfWeek)}
            organisation={organisationRow(dayOfWeek)}
            busy={saving}
            onChange={(next) => onChangeDay(dayOfWeek, next)}
            onCopyToAll={onCopyToAll}
          />
        ))}
      </div>

      <ScheduleSaveBar
        dirty={dirty}
        saving={saving}
        invalidCount={invalidCount}
        saved={saved}
        onSubmit={onSubmit}
        onDiscard={onDiscard}
      />
    </Card>
  );
}
