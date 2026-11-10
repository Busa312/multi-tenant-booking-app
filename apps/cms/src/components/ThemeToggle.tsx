import { useState } from "react";
import { useI18n } from "../i18n/I18nContext.js";
import { DARK_THEME, LIGHT_THEME, currentTheme, setTheme, type ThemeName } from "../lib/theme.js";
import { Icon } from "./ui/Icon.js";

// Light/dark switch for the top bar. The choice persists; until the user makes
// one, the CMS follows the OS setting.
export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setThemeState] = useState<ThemeName>(currentTheme);
  const isDark = theme === DARK_THEME;

  function toggle() {
    const next = isDark ? LIGHT_THEME : DARK_THEME;
    setTheme(next);
    setThemeState(next);
  }

  const label = t(isDark ? "shell.themeLight" : "shell.themeDark");

  return (
    <button type="button" className="btn btn-square btn-ghost btn-sm" onClick={toggle} aria-label={label} title={label}>
      <Icon name={isDark ? "light_mode" : "dark_mode"} size={20} />
    </button>
  );
}
