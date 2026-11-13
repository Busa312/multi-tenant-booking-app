import type { ReactNode } from "react";

interface TableHeadProps {
  /** CSS grid column template, e.g. "1.3fr 1.6fr 130px". */
  columns: string;
  children: ReactNode;
}

export function TableHead({ columns, children }: TableHeadProps) {
  return (
    <div
      className="grid items-center gap-3 bg-base-200/60 px-5 py-2.5 text-xs font-semibold text-base-content/65"
      // The column template is supplied per table — a runtime value.
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </div>
  );
}
