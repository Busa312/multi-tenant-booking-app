import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";
import styles from "./Pill.module.css";

export type PillTone = "neutral" | "warning" | "success" | "danger";

interface PillProps {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}

// Status chip. Tones replace the ad-hoc fg/bg color maps that pages used to
// carry inline (e.g. professional login/active status).
export function Pill({ tone = "neutral", children, className }: PillProps) {
  return <span className={cx(styles.pill, styles[tone], className)}>{children}</span>;
}
