import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";
import styles from "./Field.module.css";

interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

// Label + control wrapper. Owns the vertical rhythm between fields so pages
// stop hand-tuning `marginBottom` on every input.
export function Field({ label, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}
