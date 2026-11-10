import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";
import { Icon } from "./Icon.js";

interface AlertProps {
  variant?: "error" | "warning" | "success";
  /** Drop the default bottom margin — for grid cells and the last thing in a container. */
  flush?: boolean;
  children: ReactNode;
  className?: string;
}

const ICONS = { error: "error", warning: "warning", success: "check_circle" } as const;

// Inline status/error banner. `error` announces assertively (role="alert"),
// the calmer variants use role="status".
export function Alert({ variant = "error", flush, children, className }: AlertProps) {
  return (
    <div
      className={cx(
        "alert alert-soft items-start text-sm",
        !flush && "mb-4",
        variant === "error" && "alert-error",
        variant === "warning" && "alert-warning",
        variant === "success" && "alert-success",
        className,
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon name={ICONS[variant]} size={20} />
      <div>{children}</div>
    </div>
  );
}
