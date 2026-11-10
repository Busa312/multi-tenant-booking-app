import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";

export type PillTone = "neutral" | "warning" | "success" | "danger";

interface PillProps {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}

const TONES: Record<PillTone, string> = {
  neutral: "bg-base-200 text-base-content/70 border-base-300",
  warning: "badge-warning badge-soft",
  success: "badge-success badge-soft",
  danger: "badge-error badge-soft",
};

// Status chip.
export function Pill({ tone = "neutral", children, className }: PillProps) {
  return <span className={cx("badge badge-sm gap-1 font-semibold whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}
