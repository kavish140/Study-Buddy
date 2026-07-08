import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronRight, ChevronLeft, X, GraduationCap } from "lucide-react";
import { useTutorial } from "./TutorialProvider";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_W = 320;
const TOOLTIP_H_EST = 200; // estimated height for positioning math
const PAD = 12; // padding around the spotlit element
const GAP = 14; // gap between spotlight edge and tooltip

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function calcTooltipPos(sr: Rect, placement: string): { top: number; left: number } | null {
  if (placement === "center") return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 8;

  switch (placement) {
    case "right":
      return {
        left: clamp(sr.left + sr.width + GAP, margin, vw - TOOLTIP_W - margin),
        top: clamp(sr.top, margin, vh - TOOLTIP_H_EST - margin),
      };
    case "left":
      return {
        left: clamp(sr.left - TOOLTIP_W - GAP, margin, vw - TOOLTIP_W - margin),
        top: clamp(sr.top, margin, vh - TOOLTIP_H_EST - margin),
      };
    case "bottom":
      return {
        top: clamp(sr.top + sr.height + GAP, margin, vh - TOOLTIP_H_EST - margin),
        left: clamp(sr.left, margin, vw - TOOLTIP_W - margin),
      };
    case "top":
    default:
      return {
        top: clamp(sr.top - TOOLTIP_H_EST - GAP, margin, vh - TOOLTIP_H_EST - margin),
        left: clamp(sr.left, margin, vw - TOOLTIP_W - margin),
      };
  }
}

export function TutorialOverlay() {
  const { activeTour, currentStepIndex, isActive, nextStep, prevStep, skipTour } = useTutorial();
  const [spotlightRect, setSpotlightRect] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const animFrame = useRef<number | null>(null);

  const currentStep = activeTour?.steps[currentStepIndex];

  const updatePosition = useCallback(() => {
    if (!currentStep) return;

    if (!currentStep.target || currentStep.placement === "center") {
      setSpotlightRect(null);
      setTooltipPos(null);
      return;
    }

    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (!el) {
      // Element not found — advance automatically
      setSpotlightRect(null);
      setTooltipPos(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    const sr: Rect = {
      top: rect.top - PAD,
      left: rect.left - PAD,
      width: rect.width + PAD * 2,
      height: rect.height + PAD * 2,
    };
    setSpotlightRect(sr);
    setTooltipPos(calcTooltipPos(sr, currentStep.placement ?? "bottom"));
  }, [currentStep]);

  useEffect(() => {
    if (!isActive || !currentStep) {
      setSpotlightRect(null);
      setTooltipPos(null);
      return;
    }

    let t: NodeJS.Timeout | null = null;

    // If there's a target, scroll it into view first
    if (currentStep.target && currentStep.placement !== "center") {
      const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        // Wait for scroll animation then position
        t = setTimeout(() => updatePosition(), 350);
      } else {
        updatePosition();
      }
    } else {
      updatePosition();
    }

    const handleResize = () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      animFrame.current = requestAnimationFrame(updatePosition);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      if (t) clearTimeout(t);
    };
  }, [isActive, currentStep, updatePosition]);

  if (!isActive || !currentStep) return null;

  const isCenter = !currentStep.target || currentStep.placement === "center";
  const totalSteps = activeTour!.steps.length;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;

  return (
    <div className="tutorial-root" role="dialog" aria-modal="true" aria-label={currentStep.title}>
      {/* ── Backdrop ─────────────────────────────────────────────────── */}
      <div className="tutorial-backdrop" onClick={skipTour} />

      {/* ── Spotlight cutout ─────────────────────────────────────────── */}
      {spotlightRect && (
        <>
          {/* Pulsing ring */}
          <div
            className="tutorial-ring"
            style={{
              top: spotlightRect.top - 6,
              left: spotlightRect.left - 6,
              width: spotlightRect.width + 12,
              height: spotlightRect.height + 12,
            }}
          />
          {/* The spotlight hole (large box-shadow creates the dark overlay) */}
          <div
            className="tutorial-spotlight"
            style={{
              top: spotlightRect.top,
              left: spotlightRect.left,
              width: spotlightRect.width,
              height: spotlightRect.height,
            }}
          />
        </>
      )}

      {/* ── Tooltip card ─────────────────────────────────────────────── */}
      <div
        className={`tutorial-tooltip${isCenter ? " tutorial-tooltip--center" : ""}`}
        style={!isCenter && tooltipPos ? { top: tooltipPos.top, left: tooltipPos.left } : undefined}
      >
        {/* Header */}
        <div className="tutorial-tooltip__header">
          <div className="tutorial-badge">
            <GraduationCap size={13} />
            <span>{activeTour!.name}</span>
          </div>
          <button className="tutorial-close" onClick={skipTour} aria-label="Skip tour">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="tutorial-tooltip__body">
          <h3 className="tutorial-title">{currentStep.title}</h3>
          <p className="tutorial-body">{currentStep.body}</p>
        </div>

        {/* Progress bar */}
        <div className="tutorial-progress-bar-wrap">
          <div className="tutorial-progress-bar" style={{ width: `${progress}%` }} />
        </div>

        {/* Step dots + navigation */}
        <div className="tutorial-footer">
          <div className="tutorial-dots">
            {activeTour!.steps.map((_, i) => (
              <div
                key={i}
                className={`tutorial-dot ${
                  i === currentStepIndex
                    ? "tutorial-dot--active"
                    : i < currentStepIndex
                      ? "tutorial-dot--done"
                      : ""
                }`}
              />
            ))}
          </div>

          <div className="tutorial-nav">
            <button className="tutorial-skip" onClick={skipTour}>
              Skip
            </button>
            {currentStepIndex > 0 && (
              <button className="tutorial-prev" onClick={prevStep} aria-label="Previous step">
                <ChevronLeft size={15} />
              </button>
            )}
            <button className="tutorial-next" onClick={nextStep}>
              {currentStepIndex === totalSteps - 1 ? (
                "Done 🎓"
              ) : (
                <>
                  Next <ChevronRight size={15} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
