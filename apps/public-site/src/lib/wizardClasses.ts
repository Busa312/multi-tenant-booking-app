// Class strings shared by the booking wizard's steps and the manage pages, so
// every step reads as one flow: same heading, same selectable cards, same
// back/next bar. Colors are daisyUI roles only — each tenant's palette applies.

export const STEP = "flex flex-col gap-5";
export const STEP_HEADING = "text-xl font-bold tracking-tight sm:text-2xl";
export const STEP_HINT = "-mt-3 text-base-content/65";
export const STATUS_TEXT = "flex items-center gap-2 rounded-box bg-base-200 px-4 py-6 text-base-content/65";

/**
 * A selectable card (radio or checkbox semantics live on the element itself).
 * Selection is styled off `aria-checked` / `data-selected`, so the visual state
 * can never disagree with what assistive tech is told.
 */
export const OPTION_CARD =
  "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-box border border-base-300 bg-base-100 px-4 py-3.5 text-left transition-colors hover:border-primary/60 aria-checked:border-primary aria-checked:bg-primary/8 aria-checked:ring-1 aria-checked:ring-primary data-selected:border-primary data-selected:bg-primary/8 data-selected:ring-1 data-selected:ring-primary";

export const OPTION_LIST = "grid gap-2.5";

/**
 * Back/next bar. On phones it sticks to the bottom of the viewport so the
 * primary action is always in reach under a long list; from `sm` up it sits
 * in the flow.
 */
export const FOOTER =
  "sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap items-center justify-end gap-3 border-t border-base-300 bg-base-100/90 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none";

export const BTN_BACK = "btn btn-ghost";
export const BTN_NEXT = "btn btn-primary min-w-32";

export const FIELD = "flex flex-col gap-1.5";
export const LABEL = "text-sm font-medium";
export const INPUT = "input w-full";
