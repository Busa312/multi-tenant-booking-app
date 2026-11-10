import type { BusinessHours } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { isValidWindow, type DayHours } from "../lib/weekSchedule.js";
import { Button, Checkbox, Pill, TextInput } from "./ui/index.js";
import { WEEK_ROW } from "../lib/scheduleGridClasses.js";

export type ScheduleScope = "organisation" | "professional";

interface ScheduleDayRowProps {
  dayLabel: string;
  scope: ScheduleScope;
  /** This day in the working draft — what's on screen, not what's stored. */
  value: DayHours;
  /** The tenant-wide row for this day; what a professional inherits. */
  organisation: BusinessHours | null;
  /** The week is being written; every control locks until it lands. */
  busy: boolean;
  onChange: (next: DayHours) => void;
  onCopyToAll: (startTime: string, endTime: string) => void;
}

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

/**
 * One weekday, edited in place.
 *
 * Organisation scope: a day is open or closed, and closing it drops the window.
 * Professional scope: a day either has custom hours or follows the
 * organisation's — absence of a window *is* the inheritance, which is exactly
 * what the availability engine does with it (`windowsFor`), so the row shows
 * what will actually govern rather than only what's stored.
 *
 * Fully controlled: every edit goes to the page's draft and nothing here
 * touches the network. That is also why the times now report on change rather
 * than on blur — the old debounce-by-blur existed solely to keep a `<input
 * type="time">` from firing a request mid-edit, and with no request to fire,
 * waiting for blur only delayed the validation message.
 */
export function ScheduleDayRow({
  dayLabel,
  scope,
  value,
  organisation,
  busy,
  onChange,
  onCopyToAll,
}: ScheduleDayRowProps) {
  const { t } = useI18n();
  const invalid = !isValidWindow(value);

  const times = value && (
    <div className="flex min-w-0 items-center gap-2">
      {/* Labels carry the day: there are seven of these pairs on the page, and
          fourteen controls all announcing "Start"/"End" would be unnavigable. */}
      <TextInput
        type="time"
        className="flex-auto min-w-28! @min-[621px]:max-w-[130px]"
        aria-label={t("hours.startOn", { day: dayLabel })}
        value={value.startTime}
        disabled={busy}
        onChange={(e) => onChange({ ...value, startTime: e.target.value })}
      />
      <span className="flex-none text-base-content/50" aria-hidden="true">
        –
      </span>
      <TextInput
        type="time"
        className="flex-auto min-w-28! @min-[621px]:max-w-[130px]"
        aria-label={t("hours.endOn", { day: dayLabel })}
        value={value.endTime}
        disabled={busy}
        onChange={(e) => onChange({ ...value, endTime: e.target.value })}
      />
    </div>
  );

  if (scope === "organisation") {
    return (
      <div className={WEEK_ROW}>
        <div className="min-w-0 text-[13.5px] font-semibold">
          <Checkbox
            checked={value !== null}
            disabled={busy}
            onChange={(checked) => onChange(checked ? { startTime: DEFAULT_START, endTime: DEFAULT_END } : null)}
          >
            {dayLabel}
          </Checkbox>
        </div>
        {value ? (
          <>
            {times}
            <div className={"flex justify-start gap-1.5 @min-[621px]:justify-end"}>
              <Button
                iconOnly
                variant="secondary"
                icon="content_copy"
                title={t("hours.copyToAll")}
                disabled={busy || invalid}
                onClick={() => onCopyToAll(value.startTime, value.endTime)}
              />
            </div>
          </>
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-base-content/60">{t("hours.closed")}</div>
        )}
        {invalid && <div className="col-span-full text-xs text-error">{t("hours.errEndBeforeStart")}</div>}
      </div>
    );
  }

  return (
    <div className={WEEK_ROW}>
      <div className="min-w-0 text-[13.5px] font-semibold">
        <span className="inline-block py-[7px]">{dayLabel}</span>
      </div>
      {value ? (
        <>
          {times}
          <div className="flex justify-start gap-1.5 @min-[621px]:justify-end [&>*]:flex-1">
            {/* Full-size, with an icon: these are the row's action, and at the small
                size they read as thin outlines against a tall row. */}
            <Button variant="secondary" icon="undo" disabled={busy} onClick={() => onChange(null)}>
              {t("hours.useOrg")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-base-content/60 [&>*]:flex-none">
            <Pill tone="neutral">{t("hours.followsOrg")}</Pill>
            <span className="whitespace-nowrap tabular-nums">
              {organisation ? `${organisation.startTime}–${organisation.endTime}` : t("hours.closed")}
            </span>
          </div>
          <div className="flex justify-start gap-1.5 @min-[621px]:justify-end [&>*]:flex-1">
            <Button
              variant="secondary"
              icon="edit_calendar"
              disabled={busy}
              onClick={() =>
                onChange({
                  startTime: organisation?.startTime ?? DEFAULT_START,
                  endTime: organisation?.endTime ?? DEFAULT_END,
                })
              }
            >
              {t("hours.setCustom")}
            </Button>
          </div>
        </>
      )}
      {invalid && <div className="col-span-full text-xs text-error">{t("hours.errEndBeforeStart")}</div>}
    </div>
  );
}
