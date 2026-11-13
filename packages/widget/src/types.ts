/** How much of the salon's booking a widget shows. */
export type WidgetSize = "full" | "medium" | "small";

export interface WidgetOptions {
  /**
   * The salon's booking site, e.g. "https://demo.platform.ge" (or its custom
   * domain). The widget's palette, language and services all come from it.
   */
  site: string;
  /**
   * "full": the whole booking flow, inline.
   * "medium": the salon's name, today's hours, its first services, a book button.
   * "small": the salon's name, today's hours and a book button.
   * Medium and small open the full flow over the page when used. Default "full".
   */
  size?: WidgetSize;
  /** "en" or "ka". Default: the salon's main language. */
  locale?: string;
  /** Services to start with ticked (full size, and the flow medium/small open). */
  serviceIds?: string[];
  /** The branch to book at, for a salon with several. */
  locationId?: string;
  /** Called when a customer completes a booking through this widget. */
  onBooked?: (detail: BookedDetail) => void;
  /** Accessible name of the widget's frame. Default "Online booking". */
  title?: string;
}

export interface BookedDetail {
  /** The visit's start, as an ISO timestamp. */
  startAt: string;
}

export interface WidgetHandle {
  /** Opens the full booking flow over the page (what medium and small do on click). */
  open(options?: { serviceIds?: string[] }): void;
  /** Removes the widget and stops listening. */
  destroy(): void;
}
