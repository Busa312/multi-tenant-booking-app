// Class strings shared by the booking wizard's steps and the manage pages, so
// every step reads as one flow: same heading, same selectable cards, same
// back/next bar. Colors are daisyUI roles only — each tenant's palette applies.

export const STEP = "flex flex-col gap-5";
export const STEP_HEADING = "text-2xl font-extrabold tracking-tight text-balance sm:text-3xl";
export const STEP_HINT = "-mt-3 text-base-content/65";
export const STATUS_TEXT = "flex items-center gap-2 border-y border-base-300 py-6 text-base-content/65";

/**
 * A selectable card (radio or checkbox semantics live on the element itself).
 * Selection is styled off `aria-checked` / `data-selected`, so the visual state
 * can never disagree with what assistive tech is told. The selected card gets
 * a solid bar down its leading edge (an inset shadow, so nothing shifts).
 */
export const OPTION_CARD =
  "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-box border border-base-300 bg-base-100 px-4 py-3.5 text-left transition-colors hover:border-base-content/50 aria-checked:border-primary aria-checked:bg-base-200 aria-checked:shadow-[inset_4px_0_0_var(--color-primary)] data-selected:border-primary data-selected:bg-base-200 data-selected:shadow-[inset_4px_0_0_var(--color-primary)]";

export const OPTION_LIST = "grid gap-2.5";

/**
 * Back/next bar. On phones it sticks to the bottom of the viewport so the
 * primary action is always in reach under a long list; from `sm` up it sits
 * in the flow.
 */
export const FOOTER =
  "sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap items-center justify-end gap-3 border-t border-base-300 bg-base-100 px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0";

export const BTN_BACK = "btn btn-ghost";
export const BTN_NEXT = "btn btn-primary min-w-32";

export const FIELD = "flex flex-col gap-1.5";
export const LABEL = "text-sm font-medium";
export const INPUT = "input w-full";

/** Page title of the pages around the wizard (manage, resend, confirmation). */
export const PAGE_HEADING = "text-3xl font-extrabold tracking-tight text-balance sm:text-4xl";

/**
 * A booking written out like a receipt: ink rule above and below, hairlines
 * between the lines. Shared by the summary before booking and the manage page.
 */
export const SUMMARY = "divide-y divide-base-300 border-y-2 border-accent";
export const SUMMARY_ROW = "flex flex-col gap-0.5 py-3 min-[26rem]:flex-row min-[26rem]:gap-4";
export const SUMMARY_TERM = "text-sm text-base-content/65 min-[26rem]:w-28 min-[26rem]:flex-none";
