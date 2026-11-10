import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

// Small uppercase section label.
export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <div className={cx("text-xs font-bold tracking-wider text-base-content/55 uppercase", className)}>{children}</div>
  );
}
