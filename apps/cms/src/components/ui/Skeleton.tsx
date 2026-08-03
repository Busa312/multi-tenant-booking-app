import { cx } from "../../lib/cx.js";
import styles from "./Skeleton.module.css";

interface SkeletonProps {
  /** Any CSS length or percentage. Fills its container by default. */
  width?: string;
  /** Any CSS length. One line of body text by default. */
  height?: string;
  /** Pill-shaped instead of the default soft rectangle — for chips and avatars. */
  rounded?: boolean;
  className?: string;
}

/**
 * A single grey block standing in for content that hasn't arrived.
 *
 * Purely decorative: it carries `aria-hidden`, and the container that swaps it
 * for real content is what announces the wait (`role="status"`). Otherwise a
 * screen reader would read out a dozen empty boxes.
 */
export function Skeleton({ width, height, rounded, className }: SkeletonProps) {
  return (
    <span
      className={cx(styles.block, rounded === true && styles.rounded, className)}
      // Per-instance dimensions are the runtime-computed case that repo rule §6
      // reserves inline style for — a utility class per width would be a
      // worse version of the same thing.
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
