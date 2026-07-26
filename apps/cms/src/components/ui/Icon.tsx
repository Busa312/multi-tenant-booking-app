import type { CSSProperties } from "react";
import { cx } from "../../lib/cx.js";

interface IconProps {
  /** Material Symbols Outlined ligature name, e.g. "person_add". */
  name: string;
  size?: number;
  color?: string;
  className?: string;
  /** When set, the icon is treated as meaningful and exposed to a11y; otherwise decorative. */
  title?: string;
}

// Thin wrapper over the global `.ms` Material Symbols font class so icon sizing
// lives on a prop instead of an inline `style` scattered across every call site.
export function Icon({ name, size = 20, color, className, title }: IconProps) {
  const style: CSSProperties = { fontSize: size };
  if (color) {
    style.color = color;
  }
  return (
    <span className={cx("ms", className)} style={style} title={title} aria-hidden={title ? undefined : true}>
      {name}
    </span>
  );
}
