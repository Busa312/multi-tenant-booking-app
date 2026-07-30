import type { BusinessHours } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { ScheduleDayRow, type ScheduleScope } from "./ScheduleDayRow.js";
import { Card, Eyebrow } from "./ui/index.js";
import styles from "./WeeklyScheduleEditor.module.css";

interface WeeklyScheduleEditorProps {
  scope: ScheduleScope;
  /** Name of the professional being edited; drives the subtitle copy. */
  professionalName: string | null;
  /** Every business-hours row for the tenant, both scopes. */
  hours: BusinessHours[];
  /** The professional whose rows count as "own"; null for organisation scope. */
  professionalId: string | null;
  /** The weekday currently being written, so only that row locks. */
  savingDay: number | null;
  /** A week-wide write (a copy-to-all) is in flight — every row locks. */
  busy: boolean;
  onSave: (dayOfWeek: number, startTime: string, endTime: string) => void;
  onClear: (row: BusinessHours) => void;
  onCopyToAll: (startTime: string, endTime: string) => void;
}

/** Monday-first, the way a salon reads its week; `dayOfWeek` is Sunday-based. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * The whole week at once, replacing the old add-one-row-at-a-time form: seven
 * days always visible, each showing the hours that will actually apply.
 */
export function WeeklyScheduleEditor({
  scope,
  professionalName,
  hours,
  professionalId,
  savingDay,
  busy,
  onSave,
  onClear,
  onCopyToAll,
}: WeeklyScheduleEditorProps) {
  const { t, messages } = useI18n();
  const dayLabels = messages.hours.days;

  const rowFor = (dayOfWeek: number, ofProfessional: string | null) =>
    hours.find((row) => row.dayOfWeek === dayOfWeek && row.professionalId === ofProfessional) ?? null;

  return (
    <Card className={styles.card}>
      <Eyebrow>{t("hours.weeklyTitle")}</Eyebrow>
      <p className={styles.subtitle}>
        {scope === "organisation"
          ? t("hours.weeklySubtitleOrg")
          : t("hours.weeklySubtitlePro", { name: professionalName ?? "" })}
      </p>

      <div className={styles.days}>
        {WEEK_ORDER.map((dayOfWeek) => (
          <ScheduleDayRow
            key={dayOfWeek}
            // noUncheckedIndexedAccess: the catalog array is typed as string[].
            dayLabel={dayLabels[dayOfWeek] ?? String(dayOfWeek)}
            scope={scope}
            own={rowFor(dayOfWeek, professionalId)}
            organisation={rowFor(dayOfWeek, null)}
            busy={busy || savingDay === dayOfWeek}
            onSave={(startTime, endTime) => onSave(dayOfWeek, startTime, endTime)}
            onClear={() => {
              const row = rowFor(dayOfWeek, professionalId);
              if (row) onClear(row);
            }}
            onCopyToAll={onCopyToAll}
          />
        ))}
      </div>
    </Card>
  );
}
