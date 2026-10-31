import { useEffect, useSyncExternalStore } from "react";

export const ACCENT_OPTIONS = [
  { value: "blue", label: "Blue", color: "#2563eb" },
  { value: "violet", label: "Violet", color: "#7c3aed" },
  { value: "green", label: "Green", color: "#047857" },
  { value: "rose", label: "Rose", color: "#e11d48" },
] as const;

export type Accent = (typeof ACCENT_OPTIONS)[number]["value"];
const STORAGE_KEY = "aceprep-accent";
const CHANGE_EVENT = "aceprep-accent-change";
let currentAccent: Accent = "blue";

function readAccent(): Accent {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return ACCENT_OPTIONS.find((option) => option.value === stored)?.value ?? "blue";
  } catch {
    return currentAccent;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function setAccent(accent: Accent) {
  currentAccent = accent;
  try {
    localStorage.setItem(STORAGE_KEY, accent);
  } catch {
    // Keep the selection usable for this session if storage is unavailable.
  }
  document.documentElement.dataset.accent = accent;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useAccent() {
  const accent = useSyncExternalStore(subscribe, readAccent, () => "blue" as Accent);
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);
  return { accent, setAccent };
}
