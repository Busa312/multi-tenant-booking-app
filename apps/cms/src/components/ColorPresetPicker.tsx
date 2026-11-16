import type { TenantColors } from "@booking/shared-types";
import { useI18n } from "../i18n/I18nContext.js";
import { COLOR_PRESETS, isPresetSelected } from "../lib/colorPresets.js";
import { cx } from "../lib/cx.js";

interface ColorPresetPickerProps {
  /** The form's current colours, to mark the preset they match. */
  colors: Required<TenantColors>;
  onPick: (colors: Required<TenantColors>) => void;
}

/**
 * Ready-made palettes as swatches: each shows a small page in its own colours
 * (background, a primary block, a secondary rule and a line of text), so the
 * salon sees the combination rather than four loose dots. Picking one fills in
 * the form; nothing is saved until the form is.
 */
export function ColorPresetPicker({ colors, onPick }: ColorPresetPickerProps) {
  const { t } = useI18n();

  return (
    <div className="mb-5 grid grid-cols-3 gap-2" role="group" aria-label={t("branding.presets")}>
      {COLOR_PRESETS.map((preset) => {
        const selected = isPresetSelected(preset, colors);
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onPick({ ...preset.colors })}
            className={cx(
              "flex cursor-pointer flex-col justify-start rounded-field border p-1.5 text-left",
              selected ? "border-primary ring-1 ring-primary" : "border-base-300 hover:border-base-content/40",
            )}
          >
            {/* The preset's own colours are data, so they're inline (CLAUDE.md §6). */}
            <span
              aria-hidden="true"
              className="block overflow-hidden rounded-[2px] border border-base-300"
              style={{ backgroundColor: preset.colors.background }}
            >
              <span className="block h-5" style={{ backgroundColor: preset.colors.primary }} />
              <span className="block h-1" style={{ backgroundColor: preset.colors.secondary }} />
              <span className="block px-1.5 py-1.5">
                <span className="block h-1 w-3/4 rounded-full" style={{ backgroundColor: preset.colors.text }} />
                <span className="mt-1 block h-1 w-1/2 rounded-full opacity-50" style={{ backgroundColor: preset.colors.text }} />
              </span>
            </span>
            <span className="mt-1.5 block text-xs leading-tight font-medium">{t(preset.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
