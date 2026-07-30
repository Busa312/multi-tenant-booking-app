import { useEffect, useState } from "react";
import type { BusinessHours } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { Button, Checkbox, Pill, TextInput } from "./ui/index.js";
import styles from "./ScheduleDayRow.module.css";

export type ScheduleScope = "organisation" | "professional";

interface ScheduleDayRowProps {
  dayLabel: string;
  scope: ScheduleScope;
  /** The row for the scope being edited — null means this day isn't set. */
  own: BusinessHours | null;
  /** The tenant-wide row for this day; what a professional inherits. */
  organisation: BusinessHours | null;
  busy: boolean;
  onSave: (startTime: string, endTime: string) => void;
  onClear: () => void;
  onCopyToAll: (startTime: string, endTime: string) => void;
}

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

/**
 * One weekday, edited in place.
 *
 * Organisation scope: a day is open or closed, and closing it removes the row.
 * Professional scope: a day either has custom hours or follows the
 * organisation's — absence of a row *is* the inheritance, which is exactly what
 * the availability engine does with it (`windowsFor`), so the row shows what
 * will actually govern rather than only what's stored.
 */
export function ScheduleDayRow({
  dayLabel,
  scope,
  own,
  organisation,
  busy,
  onSave,
  onClear,
  onCopyToAll,
}: ScheduleDayRowProps) {
  const { t } = useI18n();
  const [start, setStart] = useState(own?.startTime ?? DEFAULT_START);
  const [end, setEnd] = useState(own?.endTime ?? DEFAULT_END);

  // Re-sync when the saved row changes underneath (another save, a scope
  // switch, a reload) so the inputs never show a stale draft.
  useEffect(() => {
    setStart(own?.startTime ?? DEFAULT_START);
    setEnd(own?.endTime ?? DEFAULT_END);
  }, [own?.id, own?.startTime, own?.endTime]);

  const invalid = end <= start;

  /** Times commit on blur, not per keystroke — a time input fires mid-edit. */
  function commit(nextStart: string, nextEnd: string) {
    if (nextEnd <= nextStart) return;
    if (own && nextStart === own.startTime && nextEnd === own.endTime) return;
    onSave(nextStart, nextEnd);
  }

  const times = (
    <div className={styles.times}>
      {/* Labels carry the day: there are seven of these pairs on the page, and
          fourteen controls all announcing "Start"/"End" would be unnavigable. */}
      <TextInput
        type="time"
        className={styles.time}
        aria-label={t("hours.startOn", { day: dayLabel })}
        value={start}
        disabled={busy}
        onChange={(e) => setStart(e.target.value)}
        onBlur={() => commit(start, end)}
      />
      <span className={styles.dash} aria-hidden="true">
        –
      </span>
      <TextInput
        type="time"
        className={styles.time}
        aria-label={t("hours.endOn", { day: dayLabel })}
        value={end}
        disabled={busy}
        onChange={(e) => setEnd(e.target.value)}
        onBlur={() => commit(start, end)}
      />
    </div>
  );

  if (scope === "organisation") {
    return (
      <div className={styles.row}>
        <div className={styles.day}>
          <Checkbox
            checked={own !== null}
            onChange={(checked) => (checked ? onSave(DEFAULT_START, DEFAULT_END) : onClear())}
          >
            {dayLabel}
          </Checkbox>
        </div>
        {own ? (
          <>
            {times}
            <div className={styles.actions}>
              <Button
                iconOnly
                size="sm"
                variant="secondary"
                icon="content_copy"
                title={t("hours.copyToAll")}
                disabled={busy || invalid}
                onClick={() => onCopyToAll(start, end)}
              />
            </div>
          </>
        ) : (
          <div className={styles.state}>{t("hours.closed")}</div>
        )}
        {invalid && own && <div className={styles.error}>{t("hours.errEndBeforeStart")}</div>}
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.day}>
        <span className={styles.dayName}>{dayLabel}</span>
      </div>
      {own ? (
        <>
          {times}
          <div className={styles.actions}>
            <Button size="sm" variant="secondary" disabled={busy} onClick={onClear}>
              {t("hours.useOrg")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.state}>
            <Pill tone="neutral">{t("hours.followsOrg")}</Pill>
            <span className={styles.inheritedTime}>
              {organisation ? `${organisation.startTime}–${organisation.endTime}` : t("hours.closed")}
            </span>
          </div>
          <div className={styles.actions}>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                onSave(organisation?.startTime ?? DEFAULT_START, organisation?.endTime ?? DEFAULT_END)
              }
            >
              {t("hours.setCustom")}
            </Button>
          </div>
        </>
      )}
      {invalid && own && <div className={styles.error}>{t("hours.errEndBeforeStart")}</div>}
    </div>
  );
}
