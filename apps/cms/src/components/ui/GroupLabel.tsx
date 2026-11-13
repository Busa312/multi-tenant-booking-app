import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";
import { FIELD_LABEL } from "../../lib/formClasses.js";

interface GroupLabelProps {
  /** Drop the bottom margin — for a parent that already spaces its children. */
  flush?: boolean;
  children: ReactNode;
  className?: string;
}

// Names a control that isn't one input — a checklist, the service rows, the
// open time slots — so it reads exactly like a Field's label.
export function GroupLabel({ flush, children, className }: GroupLabelProps) {
  return <div className={cx(FIELD_LABEL, !flush && "mb-1.5", className)}>{children}</div>;
}
