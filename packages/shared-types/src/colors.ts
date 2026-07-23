// Tenant public-site color palette (Tenant.config_json.colors) + validation/contrast
// helpers shared by apps/api (server-side validation) and apps/cms (inline form
// validation + WCAG warning), so the rules can't drift between client and server.

export interface TenantColors {
  primary?: string;
  secondary?: string;
  background?: string;
  text?: string;
}

export const DEFAULT_TENANT_COLORS: Required<TenantColors> = {
  primary: "#2563EB",
  secondary: "#7C3AED",
  background: "#FFFFFF",
  text: "#111827",
};

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_COLOR_RE = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;

// Accepts `unknown` (not just `string`) because every caller ultimately traces
// back to an HTTP JSON body with no runtime schema validation — a color
// field can be null, a number, an array, etc. at runtime regardless of what
// TypeScript's compile-time types claim. Non-strings must fail cleanly here
// rather than throw (`"x".match` exists on strings only — a number/boolean/
// null passed to a naive string-typed check would crash instead of returning
// false, turning a validation error into a 500 downstream).
export function isValidColor(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  if (HEX_COLOR_RE.test(value)) {
    return true;
  }
  const match = value.match(RGB_COLOR_RE);
  if (!match) {
    return false;
  }
  return match.slice(1, 4).every((component) => Number(component) <= 255);
}

function parseColorToRgb(value: string): [number, number, number] | null {
  const hexMatch = value.match(HEX_COLOR_RE);
  if (hexMatch) {
    const hex = hexMatch[1] as string;
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  const rgbMatch = value.match(RGB_COLOR_RE);
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }

  return null;
}

// WCAG 2.x relative luminance / contrast ratio formulas.
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Returns null if either color is invalid (caller decides how to treat that). */
export function getContrastRatio(colorA: unknown, colorB: unknown): number | null {
  // isValidColor's <=255 bound check matters here: parseColorToRgb's regex
  // alone allows rgb() components up to 999, which would otherwise silently
  // produce an out-of-range (wrong) luminance instead of being rejected.
  if (!isValidColor(colorA) || !isValidColor(colorB)) {
    return null;
  }

  const rgbA = parseColorToRgb(colorA);
  const rgbB = parseColorToRgb(colorB);
  if (!rgbA || !rgbB) {
    return null;
  }

  const lumA = relativeLuminance(rgbA);
  const lumB = relativeLuminance(rgbB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

// Normal-text WCAG AA threshold (R60) — not distinguishing the large-text 3:1 case.
export const WCAG_AA_CONTRAST_THRESHOLD = 4.5;

export function meetsWcagAA(textColor: string, backgroundColor: string): boolean {
  const ratio = getContrastRatio(textColor, backgroundColor);
  return ratio !== null && ratio >= WCAG_AA_CONTRAST_THRESHOLD;
}
