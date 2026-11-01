import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Sparkles } from "lucide-react";
import { streamChat } from "@/lib/ai.functions";
import {
  canCoachNow,
  createActivityMeter,
  possibleDistraction,
  type CoachActivity,
  type CoachSnapshot,
} from "@/lib/session-coach";
import { Button } from "./ui/button";
import { MarkdownContent } from "./MarkdownContent";

type Props = {
  contextKey: string;
  snapshot: CoachSnapshot;
  examName?: string;
  paused: boolean;
  saving: boolean;
  monitoring: boolean;
  onMonitoringChange: (enabled: boolean) => void;
};

export function DailySessionCoach(props: Props) {
  const finished = props.snapshot.stage === "summary";
  const [proactive, setProactive] = useState(true);
  const [present, setPresent] = useState(false);
  const [activity, setActivity] = useState<CoachActivity | null>(null);
  const [reply, setReply] = useState<{ scope: string; text: string } | null>(null);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const lastInteraction = useRef(Date.now());
  const lastProgress = useRef(Date.now());
  const activityMeter = useRef<ReturnType<typeof createActivityMeter> | null>(null);
  const context = useRef(props.contextKey);
  const request = useRef<AbortController | null>(null);
  const lastSent = useRef(0);
  const completed = useRef("");
  const failed = useRef("");
  const nudged = useRef("");
  const autoCount = useRef(0);
  const history = useRef<{ role: string; content: string }[]>([]);
  const latest = useRef({ props, present, activity, proactive });
  latest.current = { props, present, activity, proactive };
  const eligible = present && !props.paused && !props.saving;

  useEffect(() => {
    // Changing screens invalidates pending advice and all question-specific history.
    context.current = props.contextKey;
    lastProgress.current = Date.now();
    history.current = [];
    setAsked("");
    setError("");
    request.current?.abort();
    request.current = null;
    setLoading(false);
  }, [props.contextKey]);

  useEffect(() => {
    const meter = createActivityMeter();
    activityMeter.current = meter;
    setActivity(null);
    const updatePresence = () =>
      setPresent(
        canCoachNow(
          !document.hidden,
          document.hasFocus(),
          lastInteraction.current,
          Date.now(),
          props.paused,
        ),
      );
    const recordable = () =>
      props.monitoring && !finished && !props.paused && !document.hidden && document.hasFocus();
    const interact = (kind: "clicks" | "keyPresses" | "scrolls") => {
      lastInteraction.current = Date.now();
      if (recordable()) meter.count(kind, Date.now());
      updatePresence();
    };
    const pointer = (e: PointerEvent) => {
      if (!e.isTrusted) return;
      lastInteraction.current = Date.now();
      if (recordable()) meter.pointer(e.clientX, e.clientY, Date.now());
      if (!latest.current.present) updatePresence();
    };
    const click = () => interact("clicks"),
      key = () => interact("keyPresses"),
      scroll = () => interact("scrolls");
    const visibility = () => {
      if (document.hidden && props.monitoring && !finished && !props.paused)
        meter.count("tabDepartures", Date.now());
      updatePresence();
    };
    const focus = () => {
      lastInteraction.current = Date.now();
      updatePresence();
    };
    document.addEventListener("pointermove", pointer, { passive: true });
    document.addEventListener("click", click, { passive: true, capture: true });
    document.addEventListener("keydown", key);
    document.addEventListener("scroll", scroll, { passive: true, capture: true });
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", focus);
    window.addEventListener("blur", updatePresence);
    updatePresence();
    const interval = window.setInterval(() => {
      updatePresence();
      setActivity(
        props.monitoring && !finished ? meter.snapshot(Date.now(), lastProgress.current) : null,
      );
    }, 5_000);
    return () => {
      if (activityMeter.current === meter) activityMeter.current = null;
      window.clearInterval(interval);
      document.removeEventListener("pointermove", pointer);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key);
      document.removeEventListener("scroll", scroll, true);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", updatePresence);
    };
  }, [props.monitoring, props.paused, finished]);

  async function send(event: string, text = "") {
    const current = latest.current;
    if (
      !canCoachNow(
        !document.hidden,
        document.hasFocus(),
        lastInteraction.current,
        Date.now(),
        current.props.paused,
      ) ||
      current.props.saving
    )
      return;
    if (!text && (!current.proactive || autoCount.current >= 40)) return;
    const scope = current.props.contextKey;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    lastSent.current = Date.now();
    if (!text) autoCount.current++;
    setLoading(true);
    failed.current = "";
    setError("");
    setReply({ scope, text: "" });
    setAsked(text);
    const prompt = JSON.stringify({
      event,
      session: current.props.snapshot,
      activity:
        current.props.monitoring && current.props.snapshot.stage !== "summary"
          ? (activityMeter.current?.snapshot(Date.now(), lastProgress.current) ?? null)
          : null,
      studentRequest: text || null,
    });
    let full = "";
    try {
      await streamChat({
        source: "daily-session",
        examName: current.props.examName,
        signal: controller.signal,
        messages: [...history.current.slice(-6), { role: "user", content: prompt }],
        onChunk: (chunk) => {
          if (controller.signal.aborted || context.current !== scope) return;
          full += chunk;
          setReply({ scope, text: full });
        },
        onDone: () => {},
      });
      if (controller.signal.aborted || context.current !== scope) return;
      history.current = [
        ...history.current.slice(-4),
        { role: "user", content: prompt },
        { role: "assistant", content: full.slice(0, 4000) },
      ];
      completed.current = scope;
    } catch (e) {
      if (controller.signal.aborted || context.current !== scope) return;
      completed.current = scope; // Fail once; retry only on a student click or new step.
      failed.current = scope;
      setReply(null);
      setError(
        e instanceof Error
          ? e.message
          : "The coach couldn’t connect. You can continue your session and retry when ready.",
      );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (eligible) return;
    const interrupted = Boolean(request.current);
    request.current?.abort();
    request.current = null;
    setLoading(false);
    // Partial text is removed so a cancelled response cannot appear complete.
    setReply((r) => (!interrupted && completed.current === props.contextKey ? r : null));
  }, [eligible, props.contextKey]);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!proactive) {
      if (request.current) setReply(null);
      request.current?.abort();
      request.current = null;
      setLoading(false);
    }
  }, [proactive]);
  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setLoading(false);
    history.current = []; // Opting out also removes prior behavior summaries from future requests.
    setReply(null);
    setAsked("");
    setError("");
    completed.current = "";
  }, [props.monitoring]);

  useEffect(() => {
    if (
      !eligible ||
      !proactive ||
      completed.current === props.contextKey ||
      autoCount.current >= 40
    )
      return;
    const timeout = window.setTimeout(
      () => {
        if (!request.current && completed.current !== props.contextKey)
          void sendRef.current("step_progress");
      },
      Math.max(1_200, 15_000 - (Date.now() - lastSent.current)),
    );
    return () => window.clearTimeout(timeout);
  }, [eligible, proactive, props.contextKey, props.monitoring]);

  useEffect(() => {
    if (!eligible || !proactive || loading || props.snapshot.stage === "summary") return;
    const interval = window.setInterval(() => {
      const now = Date.now(),
        current = latest.current;
      if (request.current || now - lastSent.current < 90_000) return;
      const scope = current.props.contextKey;
      if (failed.current === scope) return;
      const distracted = possibleDistraction(current.activity);
      const timeOnStep = now - lastProgress.current;
      const focusCheck = current.props.snapshot.stage === "task" && timeOnStep >= 180_000;
      const needsHelp = current.props.snapshot.stage !== "task" && timeOnStep >= 75_000;
      const event =
        current.props.snapshot.remainingSeconds === 0
          ? "time_budget_reached"
          : distracted
            ? "possible_distraction"
            : focusCheck
              ? "focus_check_in"
              : needsHelp
                ? "offer_small_next_step"
                : "";
      const nudgeKey = `${scope}:${event}`;
      if (!event || nudged.current === nudgeKey) return;
      nudged.current = nudgeKey;
      void sendRef.current(event);
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [eligible, proactive, loading, props.snapshot.stage]);

  const currentReply = reply?.scope === props.contextKey ? reply.text : "";
  const status = props.paused
    ? "Paused with you"
    : !present
      ? "Quiet while you’re away"
      : loading
        ? "Thinking with you…"
        : proactive
          ? "Here with you"
          : "Ask me anytime";
  return (
    <aside
      aria-label="Daily session AI coach"
      className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary ${loading ? "motion-safe:animate-pulse" : ""}`}
          >
            <Sparkles size={20} />
          </span>
          <div>
            <h2 className="font-semibold">Your study companion</h2>
            <p className="text-xs text-muted-foreground" role="status">
              {status}
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={proactive}
            onChange={(e) => setProactive(e.target.checked)}
          />{" "}
          Proactive guidance
        </label>
      </div>
      {asked && (
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <MessageCircle size={14} className="shrink-0" />
          {asked}
        </p>
      )}
      <div className="text-sm leading-relaxed max-h-64 overflow-y-auto" aria-busy={loading}>
        {currentReply ? (
          <MarkdownContent content={currentReply} />
        ) : (
          <p className="text-muted-foreground">
            {loading
              ? "Finding a useful next step…"
              : "I’ll guide you through this step. You can ask for a hint or a smaller next step anytime."}
          </p>
        )}
      </div>
      {error && (
        <div role="alert" className="text-sm space-y-2">
          <p>{error}</p>
          <Button
            size="sm"
            variant="outline"
            disabled={!eligible || loading}
            onClick={() => void send("student_retry", asked || "Guide me through this step.")}
          >
            Retry coach
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {[
          finished
            ? "What should I review next?"
            : props.snapshot.stage === "task"
              ? "Break this task down"
              : "Give me a hint",
          finished ? "Reflect on my progress" : "Help me refocus",
        ].map((text) => (
          <Button
            key={text}
            size="sm"
            variant="outline"
            disabled={!eligible || loading}
            onClick={() => void send("student_request", text)}
          >
            {text}
          </Button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim() && eligible && !loading) {
            void send("student_request", question.trim());
            setQuestion("");
          }
        }}
      >
        <input
          aria-label="Ask your session coach"
          value={question}
          maxLength={1500}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Tell me where you’re stuck…"
          className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-sm"
          disabled={props.paused}
        />
        <Button
          size="icon"
          type="submit"
          aria-label="Send to coach"
          disabled={!question.trim() || !eligible || loading}
        >
          <Send size={16} />
        </Button>
      </form>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">
          {finished
            ? "Activity collection ended with your session"
            : props.monitoring
              ? "Session activity sharing is on"
              : "Session activity sharing is off"}
        </summary>
        <div className="mt-3 space-y-2">
          <p>
            While this session is open, mouse movement patterns, click/scroll/key counts, tab
            departures, and time without progress are summarized for the AI. Only aggregates are
            shared; typed content, pointer coordinates, screenshots, and other app data aren’t sent
            as activity telemetry. These signals suggest when help may be useful; they don’t
            establish attention or distraction.
          </p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={props.monitoring}
              onChange={(e) => props.onMonitoringChange(e.target.checked)}
            />{" "}
            Share activity summaries with the coach
          </label>
          {props.monitoring && activity && (
            <p>
              Recent minute: {activity.clicks} clicks · {activity.directionChanges} pointer
              direction changes · {activity.tabDepartures} tab departures ·{" "}
              {activity.secondsWithoutProgress}s since step progress
            </p>
          )}
          <p>
            Summaries are held in memory and sent with coaching requests through the AI provider.
            Provider logs may retain requests. Turning this off clears local activity history for
            future requests.
          </p>
        </div>
      </details>
    </aside>
  );
}
