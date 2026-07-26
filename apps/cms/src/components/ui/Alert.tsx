import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";
import styles from "./Alert.module.css";

interface AlertProps {
  variant?: "error" | "warning" | "success";
  children: ReactNode;
  className?: string;
}

// Inline status/error banner. `error` announces assertively (role="alert"),
// the calmer variants use role="status".
export function Alert({ variant = "error", children, className }: AlertProps) {
  return (
    <p className={cx(styles.alert, styles[variant], className)} role={variant === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}
