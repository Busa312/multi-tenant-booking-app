import type { TimeOff } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { cx } from "../lib/cx.js";
import { formatDateTimeLabel } from "../lib/tenantTime.js";
import { Button, Card, Eyebrow, Pill } from "./ui/index.js";

interface TimeOffCardProps {
  blocks: TimeOff[];
  timezone: string;
  /** Renders the owning scope per block; null when viewing one professional. */
  labelFor: (professionalId: string | null) => string;
  busyId: string | null;
  onAdd: () => void;
  onDelete: (block: TimeOff) => void;
}

/**
 * Closures and holidays, upcoming first.
 *
 * Unlike weekly hours, time off is *additive*: a tenant-wide block and a
 * professional's own block both apply, so nothing here overrides anything —
 * which is why every applicable block is listed rather than resolved down to one.
 */
export function TimeOffCard({ blocks, timezone, labelFor, busyId, onAdd, onDelete }: TimeOffCardProps) {
  const { t, lang } = useI18n();

  const now = Date.now();
  const sorted = [...blocks].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const upcoming = sorted.filter((block) => Date.parse(block.endAt) >= now);
  const past = sorted.filter((block) => Date.parse(block.endAt) < now).reverse();

  function row(block: TimeOff, isPast: boolean) {
    return (
      <li
        key={block.id}
        className={cx("flex items-start gap-3 border-b border-base-300 py-2.5 last:border-b-0 pointer-coarse:py-3.5", isPast && "opacity-60")}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold [overflow-wrap:anywhere]">
            {formatDateTimeLabel(block.startAt, timezone, lang)} – {formatDateTimeLabel(block.endAt, timezone, lang)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Pill tone="neutral">{labelFor(block.professionalId)}</Pill>
            {block.reason && <span className="text-xs text-base-content/60 [overflow-wrap:anywhere]">{block.reason}</span>}
          </div>
        </div>
        <Button
          iconOnly
          size="sm"
          icon="delete"
          title={t("hours.deleteTitle")}
          disabled={busyId === block.id}
          onClick={() => onDelete(block)}
        />
      </li>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0">
          <Eyebrow>{t("hours.timeOff")}</Eyebrow>
          <p className="mt-1 text-[13px] text-base-content/60">{t("hours.timeOffSubtitle")}</p>
        </div>
        <Button size="sm" icon="add" className="ml-auto flex-none" onClick={onAdd}>
          {t("hours.addTimeOff")}
        </Button>
      </div>

      {blocks.length === 0 ? (
        <p className="py-4 text-base-content/60">{t("hours.emptyTimeOff")}</p>
      ) : (
        <>
          <ul>{upcoming.map((block) => row(block, false))}</ul>
          {upcoming.length === 0 && <p className="py-2 text-base-content/60">{t("hours.noUpcomingTimeOff")}</p>}
          {past.length > 0 && (
            <details className="mt-3 border-t border-base-300 pt-2.5">
              <summary className="w-fit cursor-pointer text-xs font-semibold text-primary pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center">{t("hours.pastTimeOff", { count: past.length })}</summary>
              <ul>{past.map((block) => row(block, true))}</ul>
            </details>
          )}
        </>
      )}
    </Card>
  );
}
