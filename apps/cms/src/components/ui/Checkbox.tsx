import type { ReactNode } from "react";
import styles from "./Checkbox.module.css";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

// Checkbox + inline label as one clickable row.
export function Checkbox({ checked, onChange, children }: CheckboxProps) {
  return (
    <label className={styles.row}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}
