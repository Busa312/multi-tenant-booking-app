import { cx } from "../../lib/cx.js";

export interface ButtonStyleProps {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  fullWidth?: boolean;
  iconOnly?: boolean;
  danger?: boolean;
}

// Shared by Button and ButtonLink so an anchor styled as a button and a real
// <button> stay identical from a single class source.
export function buttonClassName(
  { variant = "primary", size = "md", fullWidth, iconOnly, danger }: ButtonStyleProps,
  className?: string,
): string {
  return cx(
    "btn gap-1.5 font-semibold",
    variant === "primary" && (danger ? "btn-error" : "btn-primary"),
    variant === "secondary" && (danger ? "btn-outline btn-error" : "border-base-300 bg-base-100 shadow-none"),
    variant === "ghost" && (danger ? "btn-ghost text-error" : "btn-ghost"),
    size === "sm" && "btn-sm",
    fullWidth && "btn-block",
    iconOnly && "btn-square",
    className,
  );
}

/** Material Symbols scale a touch larger than the button's text baseline. */
export function buttonIconSize(size: "md" | "sm" = "md"): number {
  return size === "sm" ? 17 : 19;
}
