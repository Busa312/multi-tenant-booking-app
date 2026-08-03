import { useI18n } from "../i18n/I18nContext.js";
import { Button } from "./ui/index.js";
import styles from "./ScheduleSaveBar.module.css";

interface ScheduleSaveBarProps {
  /** The draft differs from what's stored. */
  dirty: boolean;
  /** A write is in flight. */
  saving: boolean;
  /** Days that can't be sent — an incomplete time, or an end before its start. */
  invalidCount: number;
  /** The last save landed and nothing has been touched since. */
  saved: boolean;
  onSubmit: () => void;
  onDiscard: () => void;
}

/**
 * The week editor's footer: what state the draft is in, and the two things you
 * can do about it.
 *
 * The status line is the part that earns its place. Now that edits no longer
 * reach the server as you make them, nothing else on the page tells you whether
 * what you are looking at has been saved — so it says so explicitly, in all
 * four states, rather than leaving the Save button's enabled-ness as the only
 * clue.
 */
export function ScheduleSaveBar({ dirty, saving, invalidCount, saved, onSubmit, onDiscard }: ScheduleSaveBarProps) {
  const { t } = useI18n();
  const blocked = invalidCount > 0;

  const status = blocked
    ? t("hours.invalidDays", { count: invalidCount })
    : dirty
      ? t("hours.unsaved")
      : saved
        ? t("hours.saved")
        : t("hours.upToDate");

  return (
    <div className={styles.bar}>
      <p className={`${styles.status} ${blocked ? styles.blocked : ""}`} role="status">
        {status}
      </p>
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" disabled={!dirty || saving} onClick={onDiscard}>
          {t("hours.discard")}
        </Button>
        <Button size="sm" disabled={!dirty || blocked || saving} onClick={onSubmit}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
