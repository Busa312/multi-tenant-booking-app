import { cx } from "../../lib/cx.js";

interface BrandMarkProps {
  /** Rendered size in px (square). */
  size: number;
  /** For a dark (neutral) background: light tile, dark tick. */
  onDark?: boolean;
}

// The Book-it mark (same drawing as apps/marketing's Logo): an ink tile with a
// tick, and the highlighter's dot. The dot's ring takes the colour of what's
// behind it, so it reads as cut out of the tile's corner.
export function BrandMark({ size, onDark }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
      <rect width="28" height="28" rx="8" className={onDark ? "fill-neutral-content" : "fill-primary"} />
      <path
        d="m8.5 14.5 3.5 3.5 7.5-8"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={onDark ? "stroke-neutral" : "stroke-primary-content"}
      />
      <circle cx="22.5" cy="5.5" r="3.5" strokeWidth="1.5" className={cx("fill-accent", onDark ? "stroke-neutral" : "stroke-base-200")} />
    </svg>
  );
}
