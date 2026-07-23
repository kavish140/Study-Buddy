import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const effective = theme === "system" ? getSystemTheme() : theme;
  if (effective === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

const VALID_THEMES: Theme[] = ["light", "dark", "system"];

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem("aceprep-theme");
    return stored && VALID_THEMES.includes(stored as Theme) ? (stored as Theme) : "system";
  });

  // A counter that forces React to re-derive effectiveTheme when the OS
  // preference flips while the user is in "system" mode.
  const [, setOsTick] = useState(0);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for OS-level changes when theme is "system"
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      applyTheme("system");
      // Bump tick so React re-renders and effectiveTheme recalculates
      setOsTick((n) => n + 1);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Apply on first mount
  useEffect(() => {
    applyTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("aceprep-theme", t);
    applyTheme(t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const effective = prev === "system" ? getSystemTheme() : prev;
      const next = effective === "dark" ? "light" : "dark";
      localStorage.setItem("aceprep-theme", next);
      applyTheme(next);
      return next;
    });
  }, []);

  const effectiveTheme: "light" | "dark" = theme === "system" ? getSystemTheme() : theme;

  return { theme, effectiveTheme, setTheme, toggle };
}
