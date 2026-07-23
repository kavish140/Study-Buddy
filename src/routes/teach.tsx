import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { streamChat } from "@/lib/ai.functions";
import { api } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Brain,
  Send,
  Loader2,
  Sparkles,
  RotateCcw,
  Trophy,
  ChevronRight,
  Lightbulb,
  BookOpen,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/MarkdownContent";
import { XP_REWARDS } from "@/lib/storage";
import { useAppContext } from "@/hooks/use-app-context";

export const Route = createFileRoute("/teach")({
  head: () => ({
    meta: [
      { title: "Teaching Mode · AcePrep" },
      {
        name: "description",
        content:
          "Explain concepts to the AI and get Socratic follow-up questions to deepen your understanding",
      },
    ],
  }),
  component: TeachPage,
});

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Role = "user" | "ai";

type Message = {
  id: string;
  role: Role;
  content: string;
  /** If true, this is the final score message */
  isScore?: boolean;
};

type SessionPhase =
  | "idle" // Choose topic
  | "teaching" // Active Socratic exchange
  | "done"; // Score shown

/* ─── Constants ──────────────────────────────────────────────────────────── */

/** After this many AI exchanges, trigger scoring */
const MAX_EXCHANGES = 7;

/** Suggested starter topics */
const SUGGESTED_TOPICS = [
  "Newton's Laws of Motion",
  "Integration by Parts",
  "Photoelectric Effect",
  "Cell Division (Mitosis vs Meiosis)",
  "Thermodynamics Laws",
  "Organic Chemistry — Benzene",
  "Electrostatics — Gauss's Law",
  "Limits and Continuity",
  "DNA Replication",
  "Equilibrium in Chemical Reactions",
];

const SOCRATIC_SYSTEM_PROMPT = `You are a Socratic AI tutor helping a student prepare for a competitive exam (JEE/NEET/UPSC/CAT level).

Your role:
1. The student will explain a concept to you. Ask one focused follow-up question at a time to probe their understanding deeper.
2. Never give the answer directly. Instead, guide them with hints if they're stuck.

Rules:
- Be encouraging but intellectually rigorous.
- Keep each question short and focused (1-2 sentences).
- Do not reveal the exchange count to the student.
- Use markdown for formatting in non-score messages.`;

/* ─── Score Card component ───────────────────────────────────────────────── */

function ScoreCard({ json, onRetry }: { json: string; onRetry: () => void }) {
  let data: {
    score: number;
    grade: string;
    strengths: string[];
    gaps: string[];
    summary: string;
  } | null = null;

  try {
    const raw = json.trim();
    const scoreIdx = raw.indexOf('"score"');
    if (scoreIdx !== -1) {
      const startIdx = raw.lastIndexOf("{", scoreIdx);
      const endIdx = raw.lastIndexOf("}");
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        data = JSON.parse(raw.substring(startIdx, endIdx + 1));
      }
    }
    // Fallback if the above doesn't work but it's pure JSON
    if (!data) data = JSON.parse(raw);
  } catch {
    /* fall through — show raw */
  }

  if (!data) {
    return (
      <div className="card-light rounded-2xl p-6">
        <MarkdownContent content={json} />
        <Button onClick={onRetry} className="mt-4 gap-2 bg-gradient-primary">
          <RotateCcw className="h-4 w-4" /> Try Another Topic
        </Button>
      </div>
    );
  }

  const score = Math.min(10, Math.max(0, data.score));
  const pct = score * 10;
  const gradeColor =
    score >= 8 ? "#10b981" : score >= 6 ? "#f59e0b" : score >= 4 ? "#f97316" : "#ef4444";

  return (
    <div
      className="card-light rounded-2xl overflow-hidden"
      style={{ borderTop: `4px solid ${gradeColor}` }}
    >
      {/* Score header */}
      <div className="p-6 text-center" style={{ background: `${gradeColor}10` }}>
        <div className="text-5xl font-bold font-heading mb-1" style={{ color: gradeColor }}>
          {score}
          <span className="text-2xl text-muted-foreground">/10</span>
        </div>
        <div className="text-lg font-semibold mt-1" style={{ color: gradeColor }}>
          {data.grade}
        </div>
        {/* Progress bar */}
        <div
          className="mt-3 h-2 rounded-full overflow-hidden max-w-xs mx-auto"
          style={{ background: "var(--muted)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: gradeColor }}
          />
        </div>
        {/* XP badge */}
        <div
          className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-bold"
          style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
        >
          <Zap className="h-3 w-3" /> +{XP_REWARDS.focus_session} XP earned
        </div>
      </div>

      {/* Summary */}
      <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm leading-relaxed text-muted-foreground">{data.summary}</p>
      </div>

      {/* Strengths & Gaps */}
      <div className="grid sm:grid-cols-2 gap-0 divide-x" style={{ borderColor: "var(--border)" }}>
        <div className="p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500 mb-2">
            <Trophy className="h-3.5 w-3.5" /> Strengths
          </div>
          <ul className="space-y-1">
            {data.strengths.map((s, i) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                <span className="text-emerald-500 mt-0.5">✓</span> {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500 mb-2">
            <Target className="h-3.5 w-3.5" /> Gaps to Work On
          </div>
          <ul className="space-y-1">
            {data.gaps.map((g, i) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                <span className="text-amber-500 mt-0.5">→</span> {g}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="p-5 flex justify-center">
        <Button onClick={onRetry} className="gap-2 bg-gradient-primary">
          <RotateCcw className="h-4 w-4" /> Try Another Topic
        </Button>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

function TeachPage() {
  const qc = useQueryClient();
  const { data: profile } = useQuery({ queryKey: ["userProfile"], queryFn: api.getUserProfile });
  const { contextSummary } = useAppContext();

  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [topic, setTopic] = useState("");
  const [inputTopic, setInputTopic] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  // Derive exchange count directly from user messages to prevent state desync
  const exchangeCount = messages.filter((m) => m.role === "user").length;
  const [scoreJson, setScoreJson] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Focus input when teaching starts
  useEffect(() => {
    if (phase === "teaching") inputRef.current?.focus();
  }, [phase]);

  /* ── Start session ── */
  const handleStart = useCallback(async (chosenTopic: string) => {
    if (!chosenTopic.trim()) return;
    setTopic(chosenTopic.trim());
    setMessages([]);
    setScoreJson("");
    setPhase("teaching");

    // First AI message — invite the student to explain
    const opening: Message = {
      id: crypto.randomUUID(),
      role: "ai",
      content: `Great! Let's do a **Teaching Mode** session on **${chosenTopic.trim()}**.\n\nPlease explain this concept to me as if I'm a student hearing it for the first time. Take your time — the more detail you provide, the better I can probe your understanding. 🎓`,
    };
    setMessages([opening]);
  }, []);

  /* ── Build full message history for the AI ── */
  const buildHistory = useCallback(
    (msgs: Message[], newUserContent: string) => {
      // The study-ai edge function uses Groq (OpenAI-compatible).
      // Groq requires role "user" / "assistant" — NOT Gemini's "model".
      // We embed the Socratic instructions as the opening user turn and pair it
      // with a synthetic assistant acknowledgement to seed the conversation.
      const history = msgs.map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      }));
      return [
        {
          role: "user",
          content: `${SOCRATIC_SYSTEM_PROMPT}\n\nThe topic for this session is: "${topic}". Acknowledge with a single short sentence.`,
        },
        {
          role: "assistant",
          content: `Understood. I will act as a Socratic tutor for the topic "${topic}" and ask one focused question at a time to probe your understanding.`,
        },
        ...history,
        { role: "user", content: newUserContent },
      ];
    },
    [topic],
  );

  /* ── Send student message ── */
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const aiId = crypto.randomUUID();

    const newExchanges = exchangeCount + 1;

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    abortRef.current = new AbortController();

    try {
      let aiResponse = "";
      const history = buildHistory(messages, text);

      // If we've hit MAX_EXCHANGES, append a scoring instruction
      const finalHistory =
        newExchanges >= MAX_EXCHANGES
          ? [
              ...history,
              {
                role: "user",
                content:
                  'Please evaluate my understanding now based on our conversation. Output ONLY a JSON block (no extra text) in this exact format:\n{\n  "score": <0-10>,\n  "grade": "<Excellent|Good|Needs Work|Weak>",\n  "strengths": ["..."],\n  "gaps": ["..."],\n  "summary": "One paragraph summary of the student\'s conceptual understanding."\n}',
              },
            ]
          : history;

      // Add placeholder AI message
      setMessages((prev) => [...prev, { id: aiId, role: "ai", content: "" }]);

      await streamChat({
        messages: finalHistory,
        examName: profile?.exam_name || "JEE Main",
        source: "teach",
        signal: abortRef.current.signal,
        appContext: contextSummary,
        onChunk: (chunk) => {
          aiResponse += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, content: aiResponse } : m)),
          );
        },
        onDone: () => {
          setStreaming(false);
          if (newExchanges >= MAX_EXCHANGES) {
            // Mark the AI message as the score message and switch to done phase
            setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, isScore: true } : m)));
            setScoreJson(aiResponse);
            setPhase("done");
            // Award XP for completing a teaching session
            api
              .awardXP(XP_REWARDS.focus_session)
              .then(() => qc.invalidateQueries({ queryKey: ["userStats"] }))
              .catch(() => {});
            toast.success(`Teaching session complete! +${XP_REWARDS.focus_session} XP 🎓`);
          }
        },
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      toast.error("AI failed to respond. Please try again.");
      setStreaming(false);
      // Remove the empty AI placeholder
      setMessages((prev) => prev.filter((m) => m.id !== aiId));
    }
  }, [input, streaming, exchangeCount, messages, buildHistory, profile, qc]);

  /* ── Keyboard submit ── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  /* ── Reset ── */
  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
    setTopic("");
    setInputTopic("");
    setMessages([]);
    setInput("");
    setScoreJson("");
  }, []);

  /* ── Progress indicator ── */
  const progressPct =
    phase === "teaching" || phase === "done"
      ? Math.min(100, Math.round((exchangeCount / MAX_EXCHANGES) * 100))
      : 0;

  /* ─────────────────────── RENDER ─────────────────────── */

  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto px-4 py-6 md:py-10">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 grid place-items-center shadow-glow-sm">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Teaching Mode</h1>
            <p className="text-xs text-muted-foreground">
              Explain a concept — the AI will probe your understanding
            </p>
          </div>
        </div>
        {phase !== "idle" && (
          <Button variant="outline" onClick={handleReset} className="gap-2 text-sm">
            <RotateCcw className="h-4 w-4" /> New Topic
          </Button>
        )}
      </div>

      {/* ── Idle — topic picker ── */}
      {phase === "idle" && (
        <div className="flex-1 space-y-6 animate-fade-up">
          {/* Info banner */}
          <div
            className="card-light rounded-2xl p-5 border-l-4"
            style={{ borderLeftColor: "var(--primary)" }}
          >
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                <span className="font-semibold">How it works:</span> You pick a topic and explain it
                to the AI in your own words. The AI asks Socratic follow-up questions to probe your
                understanding. After {MAX_EXCHANGES} exchanges, you receive a detailed{" "}
                <span className="text-primary font-medium">score out of 10</span> with strengths and
                gaps.
              </div>
            </div>
          </div>

          {/* Custom topic input */}
          <div className="card-light rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Enter a topic</span>
            </div>
            <div className="flex gap-2">
              <input
                value={inputTopic}
                onChange={(e) => setInputTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart(inputTopic)}
                placeholder="e.g. Faraday's Law of Induction"
                className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none border border-border"
                style={{ background: "var(--muted)" }}
              />
              <Button
                onClick={() => handleStart(inputTopic)}
                disabled={!inputTopic.trim()}
                className="bg-gradient-primary gap-2 shrink-0"
              >
                Start <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Suggested topics */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Suggested topics
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => handleStart(t)}
                  className="px-3 py-1.5 rounded-full text-xs border transition-all hover:border-primary/40 hover:text-primary"
                  style={{ background: "var(--muted)", borderColor: "var(--border)" }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Teaching session ── */}
      {(phase === "teaching" || phase === "done") && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Progress bar */}
          {phase === "teaching" && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                <span className="font-medium" style={{ color: "var(--primary)" }}>
                  {topic}
                </span>
                <span>
                  Exchange {Math.min(exchangeCount, MAX_EXCHANGES)}/{MAX_EXCHANGES}
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--muted)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: "linear-gradient(90deg, #8b5cf6, #a855f7)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {messages.map((msg) => {
              if (msg.isScore) {
                return (
                  <div key={msg.id} className="animate-fade-up">
                    <ScoreCard json={msg.content} onRetry={handleReset} />
                  </div>
                );
              }

              const isAI = msg.role === "ai";
              return (
                <div
                  key={msg.id}
                  className={cn("flex gap-3 animate-fade-up", !isAI && "flex-row-reverse")}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full shrink-0 grid place-items-center text-white text-sm",
                      isAI
                        ? "bg-gradient-to-br from-violet-500 to-purple-600"
                        : "bg-gradient-primary",
                    )}
                  >
                    {isAI ? <Sparkles className="h-4 w-4" /> : "👤"}
                  </div>

                  {/* Bubble */}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      isAI ? "card-light rounded-tl-sm" : "rounded-tr-sm text-white",
                    )}
                    style={!isAI ? { background: "var(--gradient-primary)" } : undefined}
                  >
                    {isAI ? (
                      msg.content ? (
                        <MarkdownContent content={msg.content} />
                      ) : (
                        <span className="animate-pulse text-muted-foreground">Thinking…</span>
                      )
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          {phase === "teaching" && (
            <div className="card-light rounded-2xl p-3 mt-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Explain your understanding… (Ctrl+Enter to send)"
                rows={3}
                disabled={streaming}
                className="w-full text-sm outline-none resize-none placeholder:text-muted-foreground"
                style={{ background: "transparent" }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-muted-foreground">
                  {exchangeCount < MAX_EXCHANGES
                    ? `${MAX_EXCHANGES - exchangeCount} exchange${MAX_EXCHANGES - exchangeCount !== 1 ? "s" : ""} until scoring`
                    : "Final exchange — scoring next"}
                </span>
                <Button
                  onClick={handleSend}
                  disabled={streaming || !input.trim()}
                  className="bg-gradient-primary gap-2"
                >
                  {streaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {streaming ? "Thinking…" : "Send"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
