// Layout shared by BookingTrendChart and BookingTrendChartSkeleton. The rail's
// height is what the skeleton exists to reserve, so both import it from here
// rather than each spelling it out — a tweak to one can't drift from the other.

export const TREND_FIGURE = "mt-4";

/** The plot area: a solid hairline baseline (never dashed — that reads as a threshold). */
export const TREND_RAIL = "flex h-[92px] items-end gap-px border-b border-base-300 sm:h-[108px] sm:gap-0.5";

export const TREND_COLUMN = "flex h-full min-w-0 flex-1 items-end justify-center";

/** Rounded at the data end, square on the baseline. Phones drop the width cap so 30 bars still fill the rail. */
export const TREND_BAR_SHAPE = "w-full rounded-t-[3px] rounded-b-none sm:max-w-3.5";

export const TREND_AXIS = "mt-1.5 flex justify-between text-[11.5px] text-base-content/55 tabular-nums";
