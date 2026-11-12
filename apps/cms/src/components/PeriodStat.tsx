import type { ReactNode } from "react";
import { cx } from "../lib/cx.js";

export type StatChangeTone = "good" | "bad" | "neutral";

interface PeriodStatProps {
  title: string;
  value: string;
  /** What the value is made of, e.g. "3 of 40 finished". */
  detail?: ReactNode;
  /** How it compares with the period before. */
  change?: { text: string; tone: StatChangeTone };
}

const TONE: Record<StatChangeTone, string> = {
  good: "text-success",
  bad: "text-error",
  neutral: "text-base-content/60",
};

/** One daisyUI `stat` inside a `stats` group. */
export function PeriodStat({ title, value, detail, change }: PeriodStatProps) {
  return (
    <div className="stat">
      <div className="stat-title">{title}</div>
      <div className="stat-value tabular-nums">{value}</div>
      {detail && <div className="stat-desc">{detail}</div>}
      {change && (
        <div className="stat-desc">
          <span className={cx("font-semibold", TONE[change.tone])}>{change.text}</span>
        </div>
      )}
    </div>
  );
}
