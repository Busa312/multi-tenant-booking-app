// Theme names must match the `name:` of the theme blocks in src/theme.css.
export const LIGHT_THEME = "salon";
export const DARK_THEME = "salon-dark";

export type ThemeName = typeof LIGHT_THEME | typeof DARK_THEME;

const STORAGE_KEY = "booking_cms_theme";

function readStored(): ThemeName | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === LIGHT_THEME || value === DARK_THEME ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): ThemeName {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? DARK_THEME : LIGHT_THEME;
}

/** The theme in effect: the user's explicit choice, else the OS preference. */
export function currentTheme(): ThemeName {
  return readStored() ?? systemTheme();
}

/**
 * Called once before first render. Only an explicit choice is written to
 * `data-theme`; with none, the attribute stays off and theme.css's
 * `prefersdark` theme follows the OS live.
 */
export function applyStoredTheme(): void {
  const stored = readStored();
  if (stored) document.documentElement.dataset.theme = stored;
}

export function setTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode / blocked storage: the choice just lasts for this page load.
  }
}
