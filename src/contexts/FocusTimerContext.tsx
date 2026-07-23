/**
 * FocusTimerContext
 *
 * Holds all focus-timer state at the application level (above the router) so
 * that the countdown survives navigation between pages. State is also mirrored
 * to localStorage so it survives tab refreshes.
 *
 * Must be rendered inside <QueryClientProvider> because it uses useMutation to
 * save completed focus sessions to Supabase.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FocusMode = "work" | "short_break" | "long_break";

export const FOCUS_MODES: Record<FocusMode, { label: string; defaultMinutes: number }> = {
  work: { label: "Focus", defaultMinutes: 25 },
  short_break: { label: "Short Break", defaultMinutes: 5 },
  long_break: { label: "Long Break", defaultMinutes: 15 },
};

export type FocusCustomMinutes = Record<FocusMode, number>;

const DEFAULT_CUSTOM: FocusCustomMinutes = { work: 25, short_break: 5, long_break: 15 };

export interface FocusTimerContextValue {
  // State
  mode: FocusMode;
  secondsLeft: number;
  isRunning: boolean;
  sessionsCompleted: number;
  subject: string;
  topic: string;
  customMinutes: FocusCustomMinutes;
  // Actions
  setSubject: (s: string) => void;
  setTopic: (t: string) => void;
  /** Update a specific mode's custom duration; also resets display if not running */
  updateCustomDuration: (mode: FocusMode, minutes: number) => void;
  /** Switch to a new mode — resets timer to that mode's duration */
  switchMode: (newMode: FocusMode) => void;
  /** Start/pause the timer */
  handleToggle: () => void;
  /** Reset timer to current mode's full duration */
  handleReset: () => void;
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

const LS = {
  mode: "aceprep_focus_mode",
  seconds: "aceprep_focus_seconds",
  running: "aceprep_focus_running",
  startTs: "aceprep_focus_start_ts",
  sessions: "aceprep_focus_sessions",
  subject: "aceprep_focus_subject",
  topic: "aceprep_focus_topic",
  custom: "aceprep_focus_custom",
} as const;

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / private-browsing errors
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const FocusTimerContext = createContext<FocusTimerContextValue | null>(null);

export function useFocusTimer(): FocusTimerContextValue {
  const ctx = useContext(FocusTimerContext);
  if (!ctx) throw new Error("useFocusTimer must be used within <FocusTimerProvider>");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  // ── Restore state from localStorage on first render ──
  const [mode, setMode] = useState<FocusMode>(() => lsGet<FocusMode>(LS.mode, "work"));
  const [customMinutes, setCustomMinutes] = useState<FocusCustomMinutes>(() =>
    lsGet<FocusCustomMinutes>(LS.custom, DEFAULT_CUSTOM),
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const saved = lsGet<number | null>(LS.seconds, null);
    if (saved !== null) return saved;
    const savedMode = lsGet<FocusMode>(LS.mode, "work");
    const savedCustom = lsGet<FocusCustomMinutes>(LS.custom, DEFAULT_CUSTOM);
    return savedCustom[savedMode] * 60;
  });
  const [isRunning, setIsRunning] = useState<boolean>(() => lsGet<boolean>(LS.running, false));
  const [sessionsCompleted, setSessionsCompleted] = useState<number>(() =>
    lsGet<number>(LS.sessions, 0),
  );
  const [subject, setSubjectInternal] = useState<string>(() => lsGet<string>(LS.subject, ""));
  const [topic, setTopicInternal] = useState<string>(() => lsGet<string>(LS.topic, ""));

  // ── Refs ──────────────────────────────────────────────────────────────────
  const sessionsCompletedRef = useRef(sessionsCompleted);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // sessionStartRef is NOT state (no re-render needed), persisted via lsSet explicitly
  const sessionStartRef = useRef<Date | null>(null);
  const completionFiredRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Always-fresh callback for the interval so stale closures aren't an issue
  const handleSessionCompleteRef = useRef<() => Promise<void>>(async () => {});

  // Restore sessionStartRef from localStorage on mount
  useEffect(() => {
    const savedTs = lsGet<number | null>(LS.startTs, null);
    sessionStartRef.current = savedTs ? new Date(savedTs) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep sessionsCompletedRef in sync with state
  useEffect(() => {
    sessionsCompletedRef.current = sessionsCompleted;
  });

  // ── Persist state to localStorage ─────────────────────────────────────────
  useEffect(() => {
    lsSet(LS.mode, mode);
  }, [mode]);
  useEffect(() => {
    lsSet(LS.seconds, secondsLeft);
  }, [secondsLeft]);
  useEffect(() => {
    lsSet(LS.running, isRunning);
  }, [isRunning]);
  useEffect(() => {
    lsSet(LS.sessions, sessionsCompleted);
  }, [sessionsCompleted]);
  useEffect(() => {
    lsSet(LS.subject, subject);
  }, [subject]);
  useEffect(() => {
    lsSet(LS.topic, topic);
  }, [topic]);
  useEffect(() => {
    lsSet(LS.custom, customMinutes);
  }, [customMinutes]);

  // ── Supabase mutation ─────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: api.saveFocusSession,
    onError: (error: Error) => toast.error(error.message || "Failed to save focus session"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["focusSessions"] }),
  });

  // ── Public setters ────────────────────────────────────────────────────────
  const setSubject = useCallback((s: string) => setSubjectInternal(s), []);
  const setTopic = useCallback((t: string) => setTopicInternal(t), []);

  /** Update a specific mode's duration AND reset the timer display if not running */
  const updateCustomDuration = useCallback(
    (m: FocusMode, minutes: number) => {
      setCustomMinutes((prev) => ({ ...prev, [m]: minutes }));
      // Only reset the display when: the changed mode is active, timer isn't running,
      // AND no session has been started yet (i.e. a paused mid-session timer is preserved).
      if (m === mode && !isRunning && !sessionStartRef.current) {
        setSecondsLeft(minutes * 60);
      }
    },
    [mode, isRunning],
  );

  // ── switchMode ─────────────────────────────────────────────────────────────
  const switchMode = useCallback(
    (newMode: FocusMode) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsRunning(false);
      setMode(newMode);
      setSecondsLeft(customMinutes[newMode] * 60);
      sessionStartRef.current = null;
      lsSet(LS.startTs, null);
      completionFiredRef.current = false;
    },
    [customMinutes],
  );

  // ── Session complete ───────────────────────────────────────────────────────
  const handleSessionComplete = useCallback(async () => {
    // Guard against double-firing (React StrictMode / race conditions)
    if (completionFiredRef.current) return;
    completionFiredRef.current = true;

    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);

    // Audible notification (browser beep)
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
      osc.onended = () => {
        ctx.close().catch(() => {});
        audioCtxRef.current = null;
      };
    } catch {
      // AudioContext unavailable in some environments — ignore
    }

    if (mode === "work") {
      const duration = customMinutes.work;
      await saveMutation.mutateAsync({
        subject: subject || undefined,
        topic: topic || undefined,
        duration_minutes: duration,
        completed: true,
        started_at: sessionStartRef.current?.toISOString() ?? new Date().toISOString(),
        ended_at: new Date().toISOString(),
      });
      const newCount = sessionsCompletedRef.current + 1;
      sessionsCompletedRef.current = newCount;
      setSessionsCompleted(newCount);
      toast.success(`🎉 Focus session complete! +${duration} minutes logged.`);
      // Every 4th work session triggers a long break
      const newMode: FocusMode = newCount % 4 === 0 ? "long_break" : "short_break";
      switchMode(newMode);
    } else {
      toast.success("Break over! Ready to focus?");
      switchMode("work");
    }
  }, [mode, customMinutes, subject, topic, saveMutation, switchMode]);

  // Keep the completion ref always fresh (runs after every render)
  useEffect(() => {
    handleSessionCompleteRef.current = handleSessionComplete;
  });

  // ── Countdown interval ─────────────────────────────────────────────────────
  // Flag to signal when the timer reaches zero. The actual side-effect runs
  // in a separate useEffect below, keeping the state updater pure.
  const timerHitZeroRef = useRef(false);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            timerHitZeroRef.current = true;
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

  // Fire the session-complete callback outside the state updater to keep it pure
  // and avoid double-firing in React StrictMode / Concurrent Mode.
  useEffect(() => {
    if (timerHitZeroRef.current && secondsLeft === 0 && isRunning) {
      timerHitZeroRef.current = false;
      handleSessionCompleteRef.current();
    }
  }, [secondsLeft, isRunning]);

  // ── Document title ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      const m = Math.floor(secondsLeft / 60);
      const s = secondsLeft % 60;
      document.title = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} · ${FOCUS_MODES[mode].label} · AcePrep`;
    } else {
      document.title = "AcePrep";
    }
  }, [isRunning, secondsLeft, mode]);

  // ── Toggle / Reset ─────────────────────────────────────────────────────────
  const handleToggle = useCallback(() => {
    if (!isRunning && !sessionStartRef.current) {
      sessionStartRef.current = new Date();
      lsSet(LS.startTs, sessionStartRef.current.getTime());
    }
    setIsRunning((r) => !r);
  }, [isRunning]);

  const handleReset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setSecondsLeft(customMinutes[mode] * 60);
    sessionStartRef.current = null;
    lsSet(LS.startTs, null);
    // Reset the completion guard so a subsequent run-to-zero fires the session-complete callback
    completionFiredRef.current = false;
  }, [customMinutes, mode]);

  // ── Context value ──────────────────────────────────────────────────────────
  const value: FocusTimerContextValue = {
    mode,
    secondsLeft,
    isRunning,
    sessionsCompleted,
    subject,
    topic,
    customMinutes,
    setSubject,
    setTopic,
    updateCustomDuration,
    switchMode,
    handleToggle,
    handleReset,
  };

  return <FocusTimerContext.Provider value={value}>{children}</FocusTimerContext.Provider>;
}
