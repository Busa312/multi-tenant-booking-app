/**
 * R410: the booking widget for React apps — the same widget as
 * @booking/widget, as components.
 *
 *   <BookingWidget site="https://salon.platform.ge" size="medium" />
 *   <BookingButton site="https://salon.platform.ge">Book now</BookingButton>
 */
export { BookingWidget, type BookingWidgetProps, type BookingWidgetRef } from "./BookingWidget.js";
export { BookingButton, type BookingButtonProps } from "./BookingButton.js";
export { openBooking, type BookedDetail, type WidgetSize } from "@booking/widget";
