import type { Translate } from "@/i18n/locales";
import { formatTime } from "@/lib/tenant-time";

export interface VisitPlanRow {
  key: string;
  startAt: string;
  endAt: string;
  /** Service names, already in the visitor's language. */
  services: string;
  professional: string | null;
  /** Shown struck through: a segment staff cancelled stays visible as history. */
  cancelled?: boolean;
}

interface VisitPlanProps {
  rows: VisitPlanRow[];
  timezone: string;
  locale: string;
  t: Translate;
}

// R200: who does what, when — the same list wherever a visit is shown, so the
// plan the customer picked is the plan they see confirmed and later manage.
export function VisitPlan({ rows, timezone, locale, t }: VisitPlanProps) {
  return (
    <ol className="flex flex-col">
      {rows.map((row, index) => (
        <li key={row.key} className={`flex gap-3 ${row.cancelled ? "opacity-55" : ""}`}>
          {/* A timeline rail: a dot per segment, joined by a line. */}
          <div className="flex flex-col items-center pt-1.5" aria-hidden="true">
            <span className="size-2.5 flex-none rounded-full bg-primary" />
            {index < rows.length - 1 && <span className="w-px flex-1 bg-base-300" />}
          </div>
          <div className="min-w-0 pb-3">
            <p className="text-sm font-semibold tabular-nums">
              {formatTime(row.startAt, timezone, locale)}–{formatTime(row.endAt, timezone, locale)}
            </p>
            <p className={row.cancelled ? "line-through" : ""}>{row.services}</p>
            {row.professional && (
              <p className="text-sm text-base-content/65">{t("booking.time.with", { name: row.professional })}</p>
            )}
            {row.cancelled && <p className="text-sm text-error">{t("manage.segmentCancelled")}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
