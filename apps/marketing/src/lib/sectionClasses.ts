// Every section shares one rhythm — the same width, padding and type scale —
// so a page reads as one piece. Change it here, not per section.

export const sectionClasses = {
  /** Vertical breathing room of a full-width section. */
  band: "px-4 py-24 sm:px-6 md:py-36",
  /** The content column. */
  container: "mx-auto w-full max-w-6xl",
  /** Narrow column for headings and running text. */
  narrow: "mx-auto w-full max-w-3xl text-center",
  eyebrow: "text-sm font-semibold text-base-content/60 md:text-base",
  title: "mt-3 text-4xl font-semibold leading-(--heading-leading) tracking-tight text-balance md:text-6xl",
  lead: "mt-6 text-lg leading-relaxed text-base-content/60 text-pretty md:text-xl",
  /** The same three on a dark (neutral) band. */
  eyebrowOnDark: "text-sm font-semibold text-neutral-content/60 md:text-base",
  leadOnDark: "mt-6 text-lg leading-relaxed text-neutral-content/70 text-pretty md:text-xl",
} as const;
