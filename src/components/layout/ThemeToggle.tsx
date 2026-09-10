"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { DARK_THEME, LIGHT_THEME, STORAGE_KEY, type ThemeName } from "@/lib/theme";

/**
 * Writes `data-theme` on <html> for daisyUI and persists the choice.
 * The inline script in layout.tsx applies the stored value before paint,
 * so this component only has to sync its own label afterwards.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>(LIGHT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === DARK_THEME ? DARK_THEME : LIGHT_THEME);
    setMounted(true);
  }, []);

  function toggle() {
    const next: ThemeName = theme === DARK_THEME ? LIGHT_THEME : DARK_THEME;
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode / storage disabled — the toggle still works for this visit.
    }
  }

  const isDark = mounted && theme === DARK_THEME;

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-ghost btn-circle"
      aria-label={isDark ? "Activer le thème clair" : "Activer le thème sombre"}
    >
      {/* Render the light icon until mounted to keep SSR and client markup identical. */}
      <Icon name={isDark ? "sun" : "moon"} className="h-5 w-5" />
    </button>
  );
}
