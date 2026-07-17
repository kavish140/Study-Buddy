import { createFileRoute } from "@tanstack/react-router";
import { todayIST } from "@/lib/date-utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTutorial } from "@/components/TutorialProvider";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Coffee,
  CheckCircle2,
  Flame,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/focus")({
  head: () => ({
    meta: [
      { title: "Focus Timer · AcePrep" },
      { name: "description", content: "Pomodoro focus timer for deep study sessions" },
    ],
  }),
  component: FocusPage,
});

type Mode = "work" | "short_break" | "long_break";

const MODES: Record<
  Mode,
  { label: string; minutes: number; color: string; icon: React.ElementType }
> = {
  work: { label: "Focus", minutes: 25, color: "text-primary", icon: Flame },
  short_break: { label: "Short Break", minutes: 5, color: "text-emerald-500", icon: Coffee },
  long_break: { label: "Long Break", minutes: 15, color: "text-amber-500", icon: Coffee },
};

const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology", "English", "Other"];

function FocusPage() {
  const qc = useQueryClient();
  const { triggerPageTour } = useTutorial();

  useEffect(() => {
    triggerPageTour("focus");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Use user's actual subjects if configured, with fallback to defaults
  const { data: userSubjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: api.getSubjects,
  });
  const subjectNames =
    userSubjects.length > 0 ? [...userSubjects.map((s) => s.name), "Other"] : SUBJECTS;

  // Timer state
  const [mode, setMode] = useState<Mode>("work");
  const [secondsLeft, setSecondsLeft] = useState(MODES.work.minutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  // Keep a ref in sync with sessionsCompleted so callbacks always see the latest value
  const sessionsCompletedRef = useRef(0);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [customMinutes, setCustomMinutes] = useState<Record<Mode, number>>({
    work: 25,
    short_break: 5,
    long_break: 15,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<Date | null>(null);
  // Flag to guard against double-invocation of the completion handler (React StrictMode)
  const completionFiredRef = useRef(false);
  // Reuse a single AudioContext to respect browser autoplay policies
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Hold the latest callback in a ref so the interval doesn't need to re-run on every change
  const handleSessionCompleteRef = useRef<() => Promise<void>>(async () => {});

  const totalSeconds = customMinutes[mode] * 60;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  // Today's focus sessions
  const { data: allSessions = [] } = useQuery({
    queryKey: ["focusSessions"],
    queryFn: api.getFocusSessions,
  });

  const saveMutation = useMutation({
    mutationFn: api.saveFocusSession,
    onError: (error) => toast.error(error.message || "Operation failed"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["focusSessions"] }),
  });

  const todaySessions = allSessions.filter((s) => {
    if (!s.started_at || !s.completed) return false;
    const date = new Date(s.started_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return date === todayIST();
  });
  const totalFocusMinutes = todaySessions.reduce((sum, s) => sum + s.duration_minutes, 0);

  const switchMode = useCallback(
    (newMode: Mode) => {
      // Confirm before discarding an active work session
      if (isRunning && mode === "work" && sessionStartRef.current) {
        if (!window.confirm("You have an active focus session. Discard progress?")) return;
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsRunning(false);
      setMode(newMode);
      setSecondsLeft(customMinutes[newMode] * 60);
      sessionStartRef.current = null;
      completionFiredRef.current = false;
    },
    [customMinutes, isRunning, mode],
  );

  const handleSessionComplete = useCallback(async () => {
    // Guard: prevent double-firing (React StrictMode or race conditions)
    if (completionFiredRef.current) return;
    completionFiredRef.current = true;

    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);

    // Play sound notification (browser beep) — reuse AudioContext to respect browser policies
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
      // Close the AudioContext after the sound finishes to free resources
      osc.onended = () => {
        ctx.close().catch(() => {});
        audioCtxRef.current = null;
      };
    } catch {
      // AudioContext may be unavailable in some browser environments
    }

    if (mode === "work") {
      const duration = customMinutes.work;
      await saveMutation.mutateAsync({
        subject: subject || undefined,
        topic: topic || undefined,
        duration_minutes: duration,
        completed: true,
        started_at: sessionStartRef.current?.toISOString() || new Date().toISOString(),
        ended_at: new Date().toISOString(),
      });
      // Use the ref value (always up-to-date) instead of the stale closure value
      const newCount = sessionsCompletedRef.current + 1;
      sessionsCompletedRef.current = newCount;
      setSessionsCompleted(newCount);
      toast.success(`🎉 Focus session complete! +${duration} minutes logged.`);

      // Auto switch to break — every 4th work session triggers a long break
      const newMode: Mode = newCount % 4 === 0 ? "long_break" : "short_break";
      switchMode(newMode);
    } else {
      toast.success("Break over! Ready to focus?");
      switchMode("work");
    }
  }, [mode, customMinutes, subject, topic, saveMutation, switchMode]);

  // Keep the ref in sync with the latest callback (runs after every render)
  useEffect(() => {
    handleSessionCompleteRef.current = handleSessionComplete;
  });

  // Countdown tick — only depends on isRunning; uses ref to avoid stale closures
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            // Schedule completion outside the state setter to avoid side effects
            // inside the updater function (which React may call multiple times).
            setTimeout(() => handleSessionCompleteRef.current(), 0);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Update document title while running; restore app title on unmount
  useEffect(() => {
    if (isRunning) {
      document.title = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} · ${MODES[mode].label} · AcePrep`;
    } else {
      document.title = "Focus Timer · AcePrep";
    }
    return () => {
      document.title = "AcePrep";
    };
  }, [isRunning, minutes, seconds, mode]);

  const handleToggle = () => {
    if (!isRunning && !sessionStartRef.current) {
      sessionStartRef.current = new Date();
    }
    setIsRunning((r) => !r);
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setSecondsLeft(customMinutes[mode] * 60);
    sessionStartRef.current = null;
  };

  // SVG circle progress
  const r = 90;
  const circ = 2 * Math.PI * r;
  const strokeDash = circ * (1 - progress / 100);

  const ModeIcon = MODES[mode].icon;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow-sm">
            <Timer className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Focus Timer</h1>
            <p className="text-sm text-muted-foreground">Pomodoro · deep work sessions</p>
          </div>
        </div>
        <button
          onClick={() => setShowSettings((s) => !s)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: "transparent" }}
        >
          Settings{" "}
          {showSettings ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="card-light rounded-2xl p-5 mb-6 space-y-4">
          <h3 className="font-medium text-sm">Custom Durations (minutes)</h3>
          <div className="grid grid-cols-3 gap-3">
            {(Object.entries(customMinutes) as [Mode, number][]).map(([k, v]) => (
              <div key={k}>
                <label className="text-xs text-muted-foreground capitalize">
                  {k.replace("_", " ")}
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={v}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setCustomMinutes((prev) => ({ ...prev, [k]: val }));
                    // Only reset the timer display if the timer is NOT running,
                    // to avoid discarding progress mid-session.
                    if (mode === k && !isRunning) setSecondsLeft(val * 60);
                  }}
                  className="w-full mt-1 rounded-lg px-3 py-2 text-sm bg-transparent outline-none border border-border"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode selector */}
      <div className="flex gap-2 mb-8 card-light rounded-xl p-1">
        {(Object.entries(MODES) as [Mode, (typeof MODES)[Mode]][]).map(([k, v]) => (
          <button
            key={k}
            onClick={() => switchMode(k)}
            style={
              mode === k
                ? {
                    background: "var(--feat-focus-bg)",
                    color: "var(--feat-focus)",
                    borderColor: "var(--feat-focus)",
                  }
                : {}
            }
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border",
              mode === k
                ? "border"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Timer circle */}
      <div className="flex flex-col items-center mb-8" data-tour="tour-focus-timer">
        <div className="relative">
          <svg width="240" height="240" className="-rotate-90">
            <circle
              cx="120"
              cy="120"
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-muted/20"
            />
            <circle
              cx="120"
              cy="120"
              r={r}
              fill="none"
              stroke="url(#timerGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={strokeDash}
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--feat-focus)" />
                <stop offset="100%" stopColor="var(--feat-focus)" stopOpacity={0.6} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <ModeIcon className="h-6 w-6 mb-1" style={{ color: "var(--feat-focus)" }} />
            <div className="text-5xl font-bold font-heading tabular-nums">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
            <div className="text-sm font-medium mt-1" style={{ color: "var(--feat-focus)" }}>
              {MODES[mode].label}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mt-6">
          <button
            onClick={handleReset}
            className="h-11 w-11 rounded-xl border border-border grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
            style={{ background: "var(--muted)" }}
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <Button
            onClick={handleToggle}
            className="h-14 w-14 rounded-2xl bg-gradient-primary shadow-glow p-0 text-lg"
            data-tour="tour-focus-start"
          >
            {isRunning ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </Button>
          <div
            className="h-11 w-11 rounded-xl border border-border grid place-items-center text-muted-foreground text-sm font-bold"
            style={{ background: "var(--muted)" }}
          >
            {sessionsCompleted}×
          </div>
        </div>
      </div>

      {/* Subject / Topic for logging */}
      {mode === "work" && (
        <div className="card-light rounded-2xl p-5 mb-6 space-y-3">
          <p className="text-sm font-medium">What are you studying?</p>
          <div className="flex gap-2 flex-wrap">
            {subjectNames.map((s) => (
              <button
                key={s}
                onClick={() => setSubject(subject === s ? "" : s)}
                style={
                  subject === s
                    ? {
                        background: "var(--feat-focus-bg)",
                        color: "var(--feat-focus)",
                        borderColor: "var(--feat-focus)",
                      }
                    : { background: "var(--muted)" }
                }
                className={cn(
                  "px-3 py-1 rounded-full text-xs border transition-all",
                  subject === s ? "" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic (e.g. Kinematics, Thermodynamics…)"
            className="w-full rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground border border-border"
            style={{ background: "var(--muted)" }}
          />
        </div>
      )}

      {/* Today's stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Sessions today",
            value: todaySessions.length,
            icon: CheckCircle2,
            iconStyle: { color: "var(--feat-syllabus)" } as React.CSSProperties,
          },
          {
            label: "Focus time",
            value: `${totalFocusMinutes}m`,
            icon: Clock,
            iconStyle: { color: "var(--feat-focus)" } as React.CSSProperties,
          },
          {
            label: "Sessions done",
            value: sessionsCompleted,
            icon: Flame,
            iconStyle: { color: "var(--feat-focus)" } as React.CSSProperties,
          },
        ].map(({ label, value, icon: Icon, iconStyle }) => (
          <div key={label} className="card-light rounded-xl p-4 text-center">
            <Icon className="h-4 w-4 mx-auto mb-1" style={iconStyle} />
            <div className="text-xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Recent sessions */}
      {todaySessions.length > 0 && (
        <div className="mt-6 card-light rounded-2xl p-5">
          <h3 className="text-sm font-medium mb-3">Today's Sessions</h3>
          <div className="space-y-2">
            {todaySessions.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--feat-syllabus)" }} />
                  <span>
                    {s.subject || "General"}
                    {s.topic ? ` · ${s.topic}` : ""}
                  </span>
                </div>
                <span className="text-muted-foreground">{s.duration_minutes}m</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
