"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { openBooking, type BookedDetail } from "@booking/widget";

export interface BookingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The salon's booking site, e.g. "https://salon.platform.ge". */
  site: string;
  /** "en", "ka" or "ru". Default: the salon's main language. */
  locale?: string;
  /** Services to start with ticked. */
  serviceIds?: string[];
  /** The branch to book at, for a salon with several. */
  locationId?: string;
  /** Called when a customer completes a booking. */
  onBooked?: (detail: BookedDetail) => void;
  /** Accessible name of the booking frame. Default "Online booking". */
  frameTitle?: string;
}

/**
 * R410: the site's own button, styled however the site likes, that opens the
 * salon's booking flow over the page. Every other prop goes to the <button>.
 * An `onClick` that calls `event.preventDefault()` stops the flow from opening.
 */
export const BookingButton = forwardRef<HTMLButtonElement, BookingButtonProps>(function BookingButton(
  { site, locale, serviceIds, locationId, onBooked, frameTitle, onClick, type = "button", children, ...buttonProps },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      {...buttonProps}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        try {
          openBooking({ site, locale, serviceIds, locationId, onBooked, title: frameTitle });
        } catch (error) {
          console.error(error);
        }
      }}
    >
      {children}
    </button>
  );
});
