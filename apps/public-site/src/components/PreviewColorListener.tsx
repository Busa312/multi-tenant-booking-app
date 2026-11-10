"use client";

import { useEffect } from "react";
import { isValidColor } from "@booking/shared-types";
import type { TenantColors } from "@booking/shared-types";
import { tenantThemeVars } from "@/lib/tenant-theme";

const MESSAGE_TYPE = "booking:preview-colors";
const KEYS = ["primary", "secondary", "background", "text"] as const;

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

/** The colors currently on the page — the layout's, or an earlier preview's. */
function currentColors(): Required<TenantColors> {
  const style = getComputedStyle(document.documentElement);
  const read = (key: (typeof KEYS)[number]) => style.getPropertyValue(`--tenant-${key}`).trim();
  return { primary: read("primary"), secondary: read("secondary"), background: read("background"), text: read("text") };
}

/**
 * Lets apps/cms's BrandingSettings page preview *unsaved* color edits (R80)
 * by embedding this site in an iframe and postMessage-ing draft colors in —
 * no save, no revalidation round-trip needed for the preview itself.
 *
 * Draft colors are merged over the current ones and run through the same
 * `tenantThemeVars` the layout uses, so the derived values (button text,
 * light/dark controls, status colors) update along with them.
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

      const merged = currentColors();
      for (const key of KEYS) {
        const value = event.data.colors[key];
        if (isValidColor(value)) merged[key] = value;
      }
      if (!KEYS.every((key) => isValidColor(merged[key]))) return;

      const root = document.documentElement.style;
      for (const [property, value] of Object.entries(tenantThemeVars(merged))) {
        root.setProperty(property, value);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}
