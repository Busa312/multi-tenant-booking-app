interface ChevronRightProps {
  className?: string;
}

/**
 * The small chevron after a "more" link or on a row that leads somewhere.
 * Drawn in the current text color, so it follows the tenant's palette;
 * decorative — the link's own text is what's announced.
 */
export function ChevronRight({ className = "size-4" }: ChevronRightProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.5 5 12.5 10 7.5 15" />
    </svg>
  );
}
