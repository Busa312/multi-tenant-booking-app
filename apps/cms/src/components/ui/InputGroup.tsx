import type { InputHTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx.js";

interface InputGroupProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Static, non-interactive trailing content (e.g. a domain suffix). */
  suffix?: ReactNode;
  /** Interactive trailing button (e.g. "Copy"). Takes precedence over `suffix`. */
  action?: { label: string; onClick: () => void };
}

// An input fused with a trailing suffix/affix in a single bordered control.
export function InputGroup({ suffix, action, className, ...inputProps }: InputGroupProps) {
  if (action) {
    return (
      <div className={cx("join w-full", className)}>
        <input className="input join-item w-full min-w-0" {...inputProps} />
        <button type="button" className="btn join-item border-base-300" onClick={action.onClick}>
          {action.label}
        </button>
      </div>
    );
  }

  return (
    <label className={cx("input w-full", className)}>
      <input className="min-w-0 grow" {...inputProps} />
      {suffix != null && <span className="text-base-content/55">{suffix}</span>}
    </label>
  );
}
