import { brandName } from "../../lib/brand.js";
import { cx } from "../../lib/cx.js";
import { BrandMark } from "./BrandMark.js";

interface BrandProps {
  size?: "md" | "lg";
  /** Render for a dark background (light ink). */
  onDark?: boolean;
  className?: string;
}

// The product wordmark (mark + name), reused by the app shell and the auth screens.
export function Brand({ size = "md", onDark, className }: BrandProps) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", onDark && "text-neutral-content", className)}>
      <BrandMark size={size === "lg" ? 36 : 32} onDark={onDark} />
      <span className={cx("font-display leading-none font-bold", size === "lg" ? "text-3xl" : "text-2xl")}>
        {brandName}
      </span>
    </span>
  );
}
