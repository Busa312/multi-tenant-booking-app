/*
 * The week's shared column tracks: WeeklyScheduleEditor puts WEEK_GRID on the
 * container, and each ScheduleDayRow is a subgrid of it. One grid rather than
 * seven means a day showing two time inputs and a day showing "Follows
 * organisation" agree on where the action column starts, so the week doesn't
 * step in and out down the page.
 *
 * The breakpoint is a *container* query against the editor card (which carries
 * `@container`), not a viewport query: the card's width doesn't track the
 * viewport, because the Hours page stacks its columns below `2xl`.
 *
 * 621px is the sum of what three columns need: a 128px day (fits the longest
 * day name in both catalogs, "Wednesday" / "ოთხშაბათი"), two 112px time inputs
 * with their dash and gaps, and roughly 185px for the longest action label.
 * Below that the row stacks — giving up height rather than legibility.
 */
export const WEEK_GRID = "grid grid-cols-1 gap-x-3 @min-[621px]:grid-cols-[128px_minmax(0,1fr)_auto]";

/*
 * Subgrid, so all seven rows resolve against WEEK_GRID's tracks. The min-height
 * evens out a ~43px row of time inputs and a ~24px row with a pill, which
 * otherwise ripple wherever they alternate; stacked rows are tall already.
 */
export const WEEK_ROW =
  "col-span-full grid grid-cols-subgrid items-center gap-y-2 border-b border-base-300 py-2.5 last:border-b-0 pointer-coarse:py-3.5 @min-[621px]:min-h-16";
