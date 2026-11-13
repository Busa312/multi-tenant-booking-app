import { cx } from "../../lib/cx.js";
import { Icon } from "./Icon.js";

interface BrandProps {
  size?: "md" | "lg";
  /** Render for a dark background (light ink). */
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
          size === "lg" ? "size-9" : "size-8",
          onDark ? "bg-neutral-content text-neutral" : "bg-neutral text-neutral-content",
        )}
      >
        <Icon name="content_cut" size={size === "lg" ? 20 : 18} />
      </span>
      <span className={cx("font-display leading-none font-bold", size === "lg" ? "text-3xl" : "text-2xl")}>
        Booking CMS
      </span>
    </span>
  );
}
