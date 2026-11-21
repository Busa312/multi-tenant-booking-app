// Class strings shared by the booking wizard's steps and the manage pages, so
// every step reads as one flow: same heading, same selectable cards, same
// back/next bar. Colors are daisyUI roles only — each tenant's palette applies.

export const STEP = "flex flex-col gap-5";
export const STEP_HEADING = "text-3xl font-semibold tracking-tight text-balance sm:text-4xl";
export const STEP_HINT = "-mt-3 text-pretty text-base-content/65";
export const STATUS_TEXT = "flex items-center gap-2 rounded-box bg-base-200 px-5 py-6 text-base-content/65";

/**
 * A selectable card (radio or checkbox semantics live on the element itself).
 * Selection is styled off `aria-checked` / `data-selected`, so the visual state
 * can never disagree with what assistive tech is told. Like a product
 * configurator: a hairline card that, chosen, gets a primary outline twice as
 * heavy (border + ring, so nothing shifts).
 */
export const OPTION_CARD =
  "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-box border border-base-300 bg-base-100 px-5 py-4 text-left transition-[border-color,box-shadow] hover:border-base-content/40 aria-checked:border-primary aria-checked:ring-1 aria-checked:ring-primary data-selected:border-primary data-selected:ring-1 data-selected:ring-primary motion-reduce:transition-none";

export const OPTION_LIST = "grid gap-2.5";

/**
 * Back/next bar. On phones it sticks to the bottom of the viewport as a
 * translucent bar (clear of the home indicator) so the primary action is
 * always in reach under a long list; from `sm` up it sits in the flow.
 */
export const FOOTER =
  "sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap items-center justify-end gap-3 border-t border-base-300/60 bg-base-100/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl backdrop-saturate-150 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none sm:backdrop-saturate-100";

export const BTN_BACK = "btn btn-ghost";
export const BTN_NEXT = "btn btn-primary min-w-32 px-6";

export const FIELD = "flex flex-col gap-1.5";
export const LABEL = "text-sm font-medium";
export const INPUT = "input input-lg w-full";

/** Page title of the pages around the wizard (manage, resend, confirmation). */
export const PAGE_HEADING = "text-4xl font-semibold tracking-tight text-balance sm:text-5xl";

/**
 * A booking written out as an inset list in a tile, hairlines between the
 * lines. Shared by the summary before booking and the manage page.
 */
export const SUMMARY = "divide-y divide-base-300 rounded-box bg-base-200 px-5";
export const SUMMARY_ROW = "flex flex-col gap-0.5 py-4 min-[26rem]:flex-row min-[26rem]:gap-4";
export const SUMMARY_TERM = "text-sm text-base-content/65 min-[26rem]:w-28 min-[26rem]:flex-none";
