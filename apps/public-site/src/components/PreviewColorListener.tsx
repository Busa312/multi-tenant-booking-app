"use client";

import { useEffect } from "react";
import { isValidColor } from "@booking/shared-types";
import type { TenantColors } from "@booking/shared-types";

const MESSAGE_TYPE = "booking:preview-colors";

interface PreviewColorsMessage {
  type: typeof MESSAGE_TYPE;
  colors: TenantColors;
}

function isPreviewColorsMessage(data: unknown): data is PreviewColorsMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === MESSAGE_TYPE &&
    typeof (data as { colors?: unknown }).colors === "object" &&
    (data as { colors?: unknown }).colors !== null
  );
}

/**
 * Lets apps/cms's BrandingSettings page preview *unsaved* color edits (R80)
 * by embedding this site in an iframe and postMessage-ing draft colors in —
 * no save, no revalidation round-trip needed for the preview itself.
 *
 * A no-op unless (a) actually embedded in an iframe and (b) the message's
 * origin matches NEXT_PUBLIC_CMS_ORIGIN exactly, so real visitors loading
 * the site directly are unaffected and an arbitrary embedding page can't
 * puppet a tenant's colors.
 */
export function PreviewColorListener() {
  useEffect(() => {
    const allowedOrigin = process.env.NEXT_PUBLIC_CMS_ORIGIN;
    if (!allowedOrigin || window.self === window.top) {
      return;
    }

    function handleMessage(event: MessageEvent) {
      if (event.origin !== allowedOrigin || !isPreviewColorsMessage(event.data)) {
        return;
      }

      for (const [key, value] of Object.entries(event.data.colors)) {
        if (typeof value === "string" && isValidColor(value)) {
          document.documentElement.style.setProperty(`--color-${key}`, value);
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}
