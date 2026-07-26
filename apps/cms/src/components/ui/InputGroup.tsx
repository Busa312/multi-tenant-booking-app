import type { InputHTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx.js";
import styles from "./InputGroup.module.css";

interface InputGroupProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Static, non-interactive trailing content (e.g. a domain suffix). */
  suffix?: ReactNode;
  /** Interactive trailing button (e.g. "Copy"). Takes precedence over `suffix`. */
  action?: { label: string; onClick: () => void };
}

// An input fused with a trailing suffix/affix in a single bordered control.
export function InputGroup({ suffix, action, className, ...inputProps }: InputGroupProps) {
  return (
    <div className={cx(styles.group, className)}>
      <input {...inputProps} />
      {action ? (
        <button type="button" className={cx(styles.suffix, styles.action)} onClick={action.onClick}>
          {action.label}
        </button>
      ) : (
        suffix != null && <span className={styles.suffix}>{suffix}</span>
      )}
    </div>
  );
}
