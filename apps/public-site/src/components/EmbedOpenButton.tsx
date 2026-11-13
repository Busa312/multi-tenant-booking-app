"use client";

import type { ReactNode } from "react";
import { isFramed, postToHost } from "@/lib/embed";

interface EmbedOpenButtonProps {
  /** Start with these services ticked. */
  serviceIds?: string[];
  /** Where to go when the page isn't framed (or scripts are off): the booking page. */
  fallbackHref: string;
  className: string;
  /** For screen readers when the visible label is short ("Book"). */
  ariaLabel?: string;
  children: ReactNode;
}

/**
 * R410: a medium or small widget's "book" action. Framed, it asks the host page
 * to open the full booking flow over the salon's site; otherwise it is an
 * ordinary link to the booking page.
 */
export function EmbedOpenButton({ serviceIds, fallbackHref, className, ariaLabel, children }: EmbedOpenButtonProps) {
  return (
    <a
      href={fallbackHref}
      target="_top"
      className={className}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (!isFramed()) return;
        event.preventDefault();
        postToHost({ type: "booking-widget:open", serviceIds });
      }}
    >
      {children}
    </a>
  );
}
