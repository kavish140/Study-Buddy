import { useEffect, useState } from "react";

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

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("aceprep-theme") as Theme) ?? "system";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for OS-level changes when theme is "system"
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Apply on first mount
  useEffect(() => {
    applyTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("aceprep-theme", t);
    applyTheme(t);
  };

  const toggle = () => {
    const effective = theme === "system" ? getSystemTheme() : theme;
    setTheme(effective === "dark" ? "light" : "dark");
  };

  const effectiveTheme: "light" | "dark" = theme === "system" ? getSystemTheme() : theme;

  return { theme, effectiveTheme, setTheme, toggle };
}
