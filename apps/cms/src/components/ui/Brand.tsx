import { cx } from "../../lib/cx.js";
import { Icon } from "./Icon.js";
import styles from "./Brand.module.css";

interface BrandProps {
  size?: "md" | "lg";
  /** Render for a dark background (light ink, no accent tint on the icon). */
  onDark?: boolean;
  className?: string;
}

// "Booking CMS" wordmark reused by the app shell and the auth screens.
export function Brand({ size = "md", onDark, className }: BrandProps) {
  return (
    <span className={cx(styles.brand, onDark && styles.onDark, className)}>
      <Icon name="content_cut" size={size === "lg" ? 26 : 24} color={onDark ? undefined : "var(--accent)"} />
      <span className={size === "lg" ? styles.textLg : styles.text}>Booking CMS</span>
    </span>
  );
}
