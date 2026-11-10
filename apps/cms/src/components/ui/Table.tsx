import type { HTMLAttributes } from "react";
import { cx } from "../../lib/cx.js";

// Bordered, rounded table container. Pair with TableHead / TableRow / TableEmpty.
export function Table({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "divide-y divide-base-300 overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-xs",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
