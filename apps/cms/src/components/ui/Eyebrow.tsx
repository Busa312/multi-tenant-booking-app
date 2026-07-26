import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";
import styles from "./Eyebrow.module.css";

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

// Small uppercase section label.
export function Eyebrow({ children, className }: EyebrowProps) {
  return <div className={cx(styles.eyebrow, className)}>{children}</div>;
}
