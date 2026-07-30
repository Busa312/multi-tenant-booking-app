import type { TimeOff } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { cx } from "../lib/cx.js";
import { formatDateTimeLabel } from "../lib/tenantTime.js";
import { Button, Card, Eyebrow, Pill } from "./ui/index.js";
import styles from "./TimeOffCard.module.css";

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
      <li key={block.id} className={cx(styles.row, isPast && styles.rowPast)}>
        <div className={styles.details}>
          <div className={styles.when}>
            {formatDateTimeLabel(block.startAt, timezone, lang)} – {formatDateTimeLabel(block.endAt, timezone, lang)}
          </div>
          <div className={styles.meta}>
            <Pill tone="neutral">{labelFor(block.professionalId)}</Pill>
            {block.reason && <span className={styles.reason}>{block.reason}</span>}
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
    <Card className={styles.card}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <Eyebrow>{t("hours.timeOff")}</Eyebrow>
          <p className={styles.subtitle}>{t("hours.timeOffSubtitle")}</p>
        </div>
        <Button size="sm" icon="add" className={styles.add} onClick={onAdd}>
          {t("hours.addTimeOff")}
        </Button>
      </div>

      {blocks.length === 0 ? (
        <p className={styles.empty}>{t("hours.emptyTimeOff")}</p>
      ) : (
        <>
          <ul className={styles.list}>{upcoming.map((block) => row(block, false))}</ul>
          {upcoming.length === 0 && <p className={styles.empty}>{t("hours.noUpcomingTimeOff")}</p>}
          {past.length > 0 && (
            <details className={styles.pastWrap}>
              <summary className={styles.pastSummary}>{t("hours.pastTimeOff", { count: past.length })}</summary>
              <ul className={styles.list}>{past.map((block) => row(block, true))}</ul>
            </details>
          )}
        </>
      )}
    </Card>
  );
}
