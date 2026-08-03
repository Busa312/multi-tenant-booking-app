import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";
import styles from "./Checkbox.module.css";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}

// Checkbox + inline label as one clickable row.
export function Checkbox({ checked, onChange, disabled, children }: CheckboxProps) {
  return (
    <label className={cx(styles.row, disabled === true && styles.disabled)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}
