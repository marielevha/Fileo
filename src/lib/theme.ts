/**
 * daisyUI theme names, declared once so the toggle, the pre-paint script and
 * the stylesheet can never disagree. The dark theme is `synthwave` — the same
 * pair the reference design uses.
 */
export const LIGHT_THEME = "light";
export const DARK_THEME = "synthwave";

export type ThemeName = typeof LIGHT_THEME | typeof DARK_THEME;

export const STORAGE_KEY = "theme";
