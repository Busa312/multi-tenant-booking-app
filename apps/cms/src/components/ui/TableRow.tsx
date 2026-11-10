import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";

interface TableRowProps {
  /** CSS grid column template — must match the row's TableHead. */
  columns: string;
  children: ReactNode;
  className?: string;
}

export function TableRow({ columns, children, className }: TableRowProps) {
  return (
    <div
      className={cx("grid items-center gap-3 px-5 py-3.5 transition-colors hover:bg-base-200/40", className)}
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </div>
  );
}
