import type { ReactNode } from "react";

interface TableEmptyProps {
  children: ReactNode;
}

// Empty-state row shown inside a Table when there are no records.
export function TableEmpty({ children }: TableEmptyProps) {
  return <div className="px-5 py-10 text-center text-sm text-base-content/55">{children}</div>;
}
