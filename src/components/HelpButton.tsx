import { useState, useEffect } from "react";
import { HelpCircle, RefreshCw, Map, X } from "lucide-react";
import { useTutorial, ALL_TOURS } from "./TutorialProvider";
import { useRouterState } from "@tanstack/react-router";

/** Map of pathname → tour id for this page */
const PAGE_TOUR_MAP: Record<string, string> = {
  "/": "global",
  "/syllabus": "syllabus",
  "/quiz": "quiz",
  "/mock-test": "mock-test",
  "/review": "review",
  "/focus": "focus",
  "/chat": "chat",
  "/pyq": "pyq",
  "/planner": "planner",
  "/notes": "notes",
  "/analytics": "analytics",
  "/community": "community",
  "/leaderboard": "leaderboard",
};

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const { startTour } = useTutorial();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const pageTourId = PAGE_TOUR_MAP[path] ?? "global";
  const pageTour = ALL_TOURS.find((t) => t.id === pageTourId);
  const appTour = ALL_TOURS.find((t) => t.id === "global");

  const handleStart = (tourId: string) => {
    setOpen(false);
    // Small delay so the menu closes first
    setTimeout(() => startTour(tourId), 100);
  };

  // Keyboard shortcut: press '?' to toggle the help menu
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore when user is typing in an input or contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="help-fab-container" data-tour="tour-help-button">
      {/* Menu */}
      {open && (
        <>
          <div className="help-fab-backdrop" onClick={() => setOpen(false)} />
          <div className="help-fab-menu">
            <div className="help-fab-menu__header">
              <span>Help & Tutorials</span>
              <button onClick={() => setOpen(false)} className="help-fab-menu__close">
                <X size={13} />
              </button>
            </div>

            {/* Current page tour */}
            {pageTour && (
              <button className="help-fab-menu__item" onClick={() => handleStart(pageTourId)}>
                <RefreshCw size={14} />
                <div>
                  <div className="help-fab-menu__item-title">{pageTour.name}</div>
                  <div className="help-fab-menu__item-hint">{pageTour.steps.length} steps</div>
                </div>
              </button>
            )}

            {/* App tour (if not already on home) */}
            {pageTourId !== "global" && appTour && (
              <button className="help-fab-menu__item" onClick={() => handleStart("global")}>
                <Map size={14} />
                <div>
                  <div className="help-fab-menu__item-title">{appTour.name}</div>
                  <div className="help-fab-menu__item-hint">Full app walkthrough</div>
                </div>
              </button>
            )}

            <div className="help-fab-menu__footer">
              Press <kbd>?</kbd> on any page to open this menu
            </div>
          </div>
        </>
      )}

      {/* FAB */}
      <button
        id="help-fab"
        className="help-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label="Help & Tutorial"
        aria-expanded={open}
      >
        <HelpCircle size={20} />
      </button>
    </div>
  );
}
