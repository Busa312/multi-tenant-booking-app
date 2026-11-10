import { useI18n } from "../i18n/I18nContext.js";
import { Pill } from "./ui/index.js";

interface PillListProps {
  items: string[];
  /** Shown as pills; the rest fold into one "+N" pill. */
  max: number;
}

/**
 * A row of name pills that never grows a table row past one line's worth: the
 * first `max` show, the rest become "+N", which lists them on hover or focus.
 */
export function PillList({ items, max }: PillListProps) {
  const { t } = useI18n();
  const shown = items.slice(0, max);
  const hidden = items.slice(max);

  return (
    <>
      {shown.map((item) => (
        <Pill key={item}>{item}</Pill>
      ))}
      {hidden.length > 0 && (
        // Focusable, so the folded names reach keyboard and screen-reader users too.
        <span
          className="tooltip"
          data-tip={hidden.join(", ")}
          tabIndex={0}
          aria-label={t("common.alsoNames", { names: hidden.join(", ") })}
        >
          <Pill>+{hidden.length}</Pill>
        </span>
      )}
    </>
  );
}
