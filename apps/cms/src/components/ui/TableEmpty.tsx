import type { ReactNode } from "react";
import styles from "./Table.module.css";

interface TableEmptyProps {
  children: ReactNode;
}

// Empty-state row shown inside a Table when there are no records.
export function TableEmpty({ children }: TableEmptyProps) {
  return <div className={styles.empty}>{children}</div>;
}
