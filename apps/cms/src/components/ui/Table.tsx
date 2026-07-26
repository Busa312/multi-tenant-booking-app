import type { HTMLAttributes } from "react";
import { cx } from "../../lib/cx.js";
import styles from "./Table.module.css";

// Bordered, rounded table container. Pair with TableHead / TableRow / TableEmpty.
export function Table({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx(styles.table, className)} {...rest}>
      {children}
    </div>
  );
}
