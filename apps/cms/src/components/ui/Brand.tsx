import { cx } from "../../lib/cx.js";
import { Icon } from "./Icon.js";

interface BrandProps {
  size?: "md" | "lg";
  /** Render for a dark background (light ink, no accent tint on the icon). */
  onDark?: boolean;
  className?: string;
}

// "Booking CMS" wordmark reused by the app shell and the auth screens.
export function Brand({ size = "md", onDark, className }: BrandProps) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", onDark && "text-neutral-content", className)}>
      <span
        className={cx(
          "grid place-items-center rounded-field",
          size === "lg" ? "size-10" : "size-9",
          onDark ? "bg-neutral-content/10" : "bg-primary/10 text-primary",
        )}
      >
        <Icon name="content_cut" size={size === "lg" ? 22 : 20} />
      </span>
      <span className={cx("font-display font-semibold tracking-tight", size === "lg" ? "text-2xl" : "text-xl")}>
        Booking CMS
      </span>
    </span>
  );
}
