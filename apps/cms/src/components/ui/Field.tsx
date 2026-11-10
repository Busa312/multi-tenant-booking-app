import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";

interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  /** Muted helper line under the control. */
  hint?: ReactNode;
  /** Drop the bottom gutter — for a field that is the whole of its container. */
  flush?: boolean;
  children: ReactNode;
  className?: string;
}

// Label + control wrapper. Owns the vertical rhythm between fields so pages
// stop hand-tuning margins on every input.
export function Field({ label, htmlFor, hint, flush, children, className }: FieldProps) {
  return (
    <div className={cx("flex flex-col gap-1.5", !flush && "mb-4", className)}>
      {label && (
        <label className="text-xs font-semibold text-base-content/70" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-xs text-base-content/55">{hint}</p>}
    </div>
  );
}
