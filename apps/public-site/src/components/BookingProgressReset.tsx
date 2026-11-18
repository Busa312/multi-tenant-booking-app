"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { clearWizard, isBookingPath } from "@/lib/wizard-storage";

/**
 * R160: leaving the booking flow ends it. The wizard keeps its progress in the
 * tab's storage so a language switch or a reload doesn't throw the customer
 * back to step 1 — but once they're on any other page (the logo, the home
 * page, the manage page after booking), the next visit to /book starts afresh
 * instead of reopening a half-made booking or the last confirmation.
 * Lives in the layout, so it sees every navigation, client-side ones included.
 */
export function BookingProgressReset() {
  const pathname = usePathname();
  useEffect(() => {
    if (!isBookingPath(pathname)) clearWizard();
  }, [pathname]);
  return null;
}
