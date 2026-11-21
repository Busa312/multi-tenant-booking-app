/**
 * The arrow on a category's open/close row (R510). Turns when its `<details>`
 * (marked `group`) is open. Drawn in the primary colour, so it follows the
 * tenant's palette; decorative — the row's own text is what's announced.
 */
export function DisclosureChevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5 shrink-0 text-primary transition-transform group-open:rotate-180 motion-reduce:transition-none"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  );
}
