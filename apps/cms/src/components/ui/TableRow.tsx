import type { CSSProperties, ReactNode } from "react";
import { cx } from "../../lib/cx.js";
import styles from "./Table.module.css";

interface TableRowProps {
  /** CSS grid column template — must match the row's TableHead. */
  columns: string;
  children: ReactNode;
  className?: string;
}

export function TableRow({ columns, children, className }: TableRowProps) {
  return (
    <div className={cx(styles.row, className)} style={{ "--cols": columns } as CSSProperties}>
      {children}
    </div>
  );
}
