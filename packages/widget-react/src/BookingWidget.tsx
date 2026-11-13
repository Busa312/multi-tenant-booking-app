"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from "react";
import { mount, type BookedDetail, type WidgetHandle, type WidgetSize } from "@booking/widget";

export interface BookingWidgetProps {
  /** The salon's booking site, e.g. "https://salon.platform.ge". */
  site: string;
  /** "full" (default), "medium" or "small". */
  size?: WidgetSize;
  /** "en" or "ka". Default: the salon's main language. */
  locale?: string;
  /** Services to start with ticked. */
  serviceIds?: string[];
  /** The branch to book at, for a salon with several. */
  locationId?: string;
  /** Called when a customer completes a booking through this widget. */
  onBooked?: (detail: BookedDetail) => void;
  /** Accessible name of the widget's frame. Default "Online booking". */
  title?: string;
  /** On the element the widget fills; it takes this element's full width. */
  className?: string;
  style?: CSSProperties;
}

/** What a `ref` on <BookingWidget> can do. */
export interface BookingWidgetRef {
  /** Opens the full booking flow over the page. */
  open(options?: { serviceIds?: string[] }): void;
}

/**
 * R410: the salon's booking widget as a React component. Renders an empty
 * element on the server and fills it on the client, so it is safe in
 * server-rendered apps (Next.js, Remix).
 *
 * The widget is rebuilt only when what it shows changes (site, size, language,
 * preselection, branch, title). A new `onBooked` function on every render is
 * fine: the latest one is always called, without reloading the frame.
 */
export const BookingWidget = forwardRef<BookingWidgetRef, BookingWidgetProps>(function BookingWidget(
  { site, size = "full", locale, serviceIds, locationId, onBooked, title, className, style },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const handle = useRef<WidgetHandle | null>(null);
  const latestOnBooked = useRef(onBooked);

  useEffect(() => {
    latestOnBooked.current = onBooked;
  });

  // Arrays compare by identity; the ids themselves are what matter.
  const servicesKey = serviceIds?.join(",") ?? "";

  useEffect(() => {
    const element = container.current;
    if (!element) return undefined;
    let widget: WidgetHandle;
    try {
      widget = mount(element, {
        site,
        size,
        locale,
        serviceIds: servicesKey ? servicesKey.split(",") : undefined,
        locationId,
        title,
        onBooked: (detail) => latestOnBooked.current?.(detail),
      });
    } catch (error) {
      // A bad `site` shouldn't take the rest of the page down with it.
      console.error(error);
      return undefined;
    }
    handle.current = widget;
    return () => {
      widget.destroy();
      handle.current = null;
    };
  }, [site, size, locale, servicesKey, locationId, title]);

  useImperativeHandle(ref, () => ({ open: (options) => handle.current?.open(options) }), []);

  return <div ref={container} className={className} style={style} />;
});
