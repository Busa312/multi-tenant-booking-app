import type { CSSProperties, ReactNode } from "react";
import styles from "./Table.module.css";

interface TableHeadProps {
  /** CSS grid column template, e.g. "1.3fr 1.6fr 130px". Fed to the row grid via a custom property. */
  columns: string;
  children: ReactNode;
}

export function TableHead({ columns, children }: TableHeadProps) {
  return (
    <div className={styles.head} style={{ "--cols": columns } as CSSProperties}>
      {children}
    </div>
  );
}
