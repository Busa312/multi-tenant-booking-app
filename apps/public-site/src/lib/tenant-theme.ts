import { getContrastRatio, isValidColor } from "@booking/shared-types";
import type { CSSProperties } from "react";
import type { TenantColors } from "@booking/shared-types";

/**
 * Turns a tenant's four saved colors into the `--tenant-*` custom properties
 * that the daisyUI "tenant" theme in app/theme.css reads.
 *
 * Isomorphic on purpose: the root layout renders these as an inline style on
 * `<html>` (see tenantThemeStyle), and PreviewColorListener applies the very same values to the
 * live page when the CMS previews unsaved colors — one function, so the
 * preview can't drift from what visitors get.
 *
 * Only ever called with colors that have passed `isValidColor` (hex or rgb()),
 * and everything it adds is a constant from this file.
 */

export type TenantThemeVars = Record<`--tenant-${string}`, string> & { "color-scheme": "light" | "dark" };

const WHITE = "#ffffff";
const INK = "#111111";

// Status colors aren't tenant-chosen, but they must stay readable on whatever
// background the tenant did choose: deep shades on a light page, light ones on
// a dark page.
const STATUS = {
  light: { info: "#1d4ed8", success: "#15803d", warning: "#a16207", error: "#b42318", content: WHITE },
  dark: { info: "#93c5fd", success: "#86efac", warning: "#fcd34d", error: "#fca5a5", content: INK },
} as const;

/** Of the candidates, the one that reads best on `background`. */
function mostReadableOn(background: string, candidates: string[]): string {
  let best = candidates[0] ?? INK;
  let bestRatio = -1;
  for (const candidate of candidates) {
    const ratio = getContrastRatio(candidate, background) ?? 0;
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  return best;
}

/**
 * Text on a filled button. Prefers the tenant's own text/background colors so
 * the palette stays theirs, and only falls back to plain white/near-black when
 * neither of those is legible (WCAG AA, 4.5:1).
 */
function contentFor(fill: string, colors: Required<TenantColors>): string {
  const own = mostReadableOn(fill, [colors.background, colors.text]);
  if ((getContrastRatio(own, fill) ?? 0) >= 4.5) return own;
  return mostReadableOn(fill, [WHITE, INK]);
}

// A rule drawn in the secondary color must still show against the page; below
// this contrast it would vanish, so the text color draws it instead.
const VISIBLE_RULE = 1.5;

export function tenantThemeVars(colors: Required<TenantColors>): TenantThemeVars {
  const scheme = mostReadableOn(colors.background, [INK, WHITE]) === INK ? "light" : "dark";
  const status = STATUS[scheme];

  return {
    "color-scheme": scheme,
    "--tenant-primary": colors.primary,
    "--tenant-primary-content": contentFor(colors.primary, colors),
    "--tenant-secondary": colors.secondary,
    "--tenant-secondary-content": contentFor(colors.secondary, colors),
    // The heavy rules of the page (letterhead, price list, receipts) — the secondary's job.
    "--tenant-accent":
      (getContrastRatio(colors.secondary, colors.background) ?? 0) >= VISIBLE_RULE ? colors.secondary : colors.text,
    "--tenant-background": colors.background,
    "--tenant-text": colors.text,
    "--tenant-info": status.info,
    "--tenant-success": status.success,
    "--tenant-warning": status.warning,
    "--tenant-error": status.error,
    "--tenant-status-content": status.content,
  };
}

/**
 * The same values as a React style object for the root `<html>` element.
 *
 * An inline style attribute rather than a `<style>` element in `<head>`:
 * React hydrates `<head>` children by position, so any browser extension that
 * injects its own `<style>` there (several do) shifts ours and breaks
 * hydration. An attribute on `<html>` can't be displaced, outranks the theme's
 * `:root` defaults, and is exactly where PreviewColorListener writes too.
 *
 * Values are re-checked with isValidColor here as defense in depth — and React
 * escapes style values, so nothing is ever interpolated into CSS text.
 */
export function tenantThemeStyle(vars: TenantThemeVars): CSSProperties {
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (key === "color-scheme") style.colorScheme = value;
    else if (isValidColor(value)) style[key] = value;
  }
  return style as CSSProperties;
}
