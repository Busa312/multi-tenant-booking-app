import type { SelectHTMLAttributes } from "react";
import { cx } from "../../lib/cx.js";
import styles from "./Select.module.css";

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(styles.select, className)} {...rest}>
      {children}
    </select>
  );
}
