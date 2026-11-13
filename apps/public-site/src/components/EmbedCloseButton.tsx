"use client";

import { useEffect } from "react";
import { postToHost } from "@/lib/embed";

interface EmbedCloseButtonProps {
  label: string;
}

/**
 * R410: closes the booking flow the host page opened over its site — by this
 * button, or by Escape. Focus lives inside this frame, so the host's dialog
 * never sees the key itself; it is forwarded.
 */
export function EmbedCloseButton({ label }: EmbedCloseButtonProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) postToHost({ type: "booking-widget:close" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <button
      type="button"
      className="btn btn-square btn-ghost btn-sm text-xl"
      aria-label={label}
      title={label}
      onClick={() => postToHost({ type: "booking-widget:close" })}
    >
      <span aria-hidden="true">×</span>
    </button>
  );
}
