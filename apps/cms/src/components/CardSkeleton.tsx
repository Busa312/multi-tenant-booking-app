import { useI18n } from "../i18n/I18nContext.js";
import { Card, Skeleton } from "./ui/index.js";

interface CardSkeletonProps {
  /**
   * How many content rows to draw. Set it to what the slot usually settles at,
   * not to a minimum: the point is to reserve the height the real card will
   * take, so undercounting reintroduces exactly the shift this removes.
   */
  rows?: number;
  /**
   * Height of one row, matching the real thing — an agenda entry is much taller
   * than a table row, and a skeleton built from the wrong unit reserves the
   * wrong space however many of them you draw.
   */
  rowHeight?: string;
  /** Drop the second heading line for cards whose real header is one line. */
  subtitle?: boolean;
  className?: string;
}

/**
 * The stand-in for a `Card` whose contents are still loading. Sized from
 * `rows` × `rowHeight` rather than a hand-tuned min-height, so the reservation
 * can be checked against the real component instead of being a magic number.
 */
export function CardSkeleton({ rows = 4, rowHeight = "44px", subtitle = true, className }: CardSkeletonProps) {
  const { t } = useI18n();

  return (
    <Card className={className} role="status" aria-busy="true" aria-label={t("common.loading")}>
      <Skeleton width="38%" height="11px" />
      {subtitle && <Skeleton width="58%" height="22px" className="mt-1.5" />}

      <div className="mt-4 flex flex-col gap-2.5">
        {Array.from({ length: rows }, (_, index) => (
          // Index keys are correct here: the rows are identical, purely
          // positional, and never reordered or filtered.
          <Skeleton key={index} height={rowHeight} />
        ))}
      </div>
    </Card>
  );
}
