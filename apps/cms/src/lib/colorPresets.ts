import type { TenantColors } from "@booking/shared-types";

export interface ColorPreset {
  id: string;
  /** i18n key of the preset's name. */
  labelKey: string;
  colors: Required<TenantColors>;
}

/**
 * Ready-made palettes for the Colors page (R80). Picking one only fills in the
 * form: the salon still previews it live and saves it like a hand-picked one,
 * through the same validation.
 */
export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: "lavender",
    labelKey: "branding.presetLavender",
    colors: { primary: "#6858e8", secondary: "#d8d8f8", background: "#f8f8f8", text: "#080838" },
  },
  {
    id: "crimson",
    labelKey: "branding.presetCrimson",
    colors: { primary: "#b04040", secondary: "#ee1111", background: "#ffffff", text: "#0d0d0d" },
  },
  {
    id: "navy-gold",
    labelKey: "branding.presetNavyGold",
    colors: { primary: "#181888", secondary: "#f8b818", background: "#ffffff", text: "#0d0d0d" },
  },
];

/** Whether two palettes are the same four colours (hex compared case-insensitively, ignoring stray spaces). */
export function sameColors(a: Required<TenantColors>, b: Required<TenantColors>): boolean {
  return (Object.keys(a) as (keyof TenantColors)[]).every(
    (key) => a[key].trim().toLowerCase() === b[key].trim().toLowerCase(),
  );
}

/** Whether the form currently holds exactly this preset. */
export function isPresetSelected(preset: ColorPreset, colors: Required<TenantColors>): boolean {
  return sameColors(preset.colors, colors);
}
