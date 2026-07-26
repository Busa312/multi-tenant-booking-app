import { cx } from "../../lib/cx.js";
import styles from "./Button.module.css";

export interface ButtonStyleProps {
  variant?: "primary" | "secondary";
  size?: "md" | "sm";
  fullWidth?: boolean;
  iconOnly?: boolean;
  danger?: boolean;
}

// Shared by Button and ButtonLink so an anchor styled as a button and a real
// <button> stay pixel-identical from a single class source.
export function buttonClassName(
  { variant = "primary", size = "md", fullWidth, iconOnly, danger }: ButtonStyleProps,
  className?: string,
): string {
  return cx(
    styles.btn,
    styles[variant],
    size === "sm" && styles.sm,
    fullWidth && styles.full,
    iconOnly && styles.iconOnly,
    danger && styles.danger,
    className,
  );
}

/** Material Symbols scale a touch smaller than the button's text baseline. */
export function buttonIconSize(size: "md" | "sm" = "md"): number {
  return size === "sm" ? 16 : 19;
}
