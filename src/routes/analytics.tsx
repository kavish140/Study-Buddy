import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { getExamById } from "@/lib/exam-catalog";
import { todayIST, formatDateIST, formatTimestampIST } from "@/lib/date-utils";
import { useTutorial } from "@/components/TutorialProvider";
import { generateQuiz } from "@/lib/ai.functions";
import { XP_REWARDS } from "@/lib/storage";
import { toast } from "sonner";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Brain,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  X,
  Play,
  RotateCcw,
  BookOpen,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import type { SavedQuiz, MockTest, PerformanceLog } from "@/lib/storage";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — AcePrep" },
      {
        name: "description",
        content: "Track your performance, identify weak areas, and monitor your progress.",
      },
    ],
  }),
  component: AnalyticsPage,
});

/* ─── constants ──────────────────────────────────────────────────────────── */

const MIN_ATTEMPTS_FOR_FULL_ANALYTICS = 5;
const DIAGNOSTIC_QUESTIONS = 6;
const DIAGNOSTIC_DURATION_SECONDS = 60 * 60; // 1 hour

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

/* ─── helpers ────────────────────────────────────────────────────────────── */

function computeQuizTrend(quizzes: SavedQuiz[], mockTests: MockTest[]) {
  const entries: { date: string; score: number; type: string }[] = [];

  quizzes.forEach((q) => {
    if (q.score === undefined || q.score === null) return;
    const total = q.questions.length;
    if (!total) return;
    const pct = Math.round((q.score / total) * 100);
    entries.push({
      date: new Date(q.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
      score: pct,
      type: "quiz",
    });
  });

  mockTests
    .filter((t) => t.status === "completed" && t.total_marks)
    .forEach((t) => {
      const pct = Math.round(((t.score ?? 0) / t.total_marks!) * 100);
      entries.push({
        date: t.created_at
          ? new Date(t.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
          : todayIST(),
        score: pct,
        type: "mock",
      });
    });

  entries.sort((a, b) => a.date.localeCompare(b.date));

  const grouped = new Map<string, number[]>();
  entries.forEach((e) => {
    const arr = grouped.get(e.date) || [];
    arr.push(e.score);
    grouped.set(e.date, arr);
  });

  return Array.from(grouped.entries()).map(([date, scores]) => ({
    date: formatDateIST(date, { month: "short", day: "numeric" }),
    score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  }));
}

function computeTopicMastery(
  quizzes: SavedQuiz[],
  mockTests: MockTest[],
  perfLogs: PerformanceLog[],
) {
  const topicMap = new Map<
    string,
    { subject: string; topic: string; correct: number; total: number }
  >();

  perfLogs.forEach((log) => {
    const key = `${log.subject}::${log.topic}`;
    const existing = topicMap.get(key) || {
      subject: log.subject,
      topic: log.topic,
      correct: 0,
      total: 0,
    };
    existing.correct += log.correct_count;
    existing.total += log.question_count;
    topicMap.set(key, existing);
  });

  quizzes.forEach((q) => {
    if (q.score === undefined || q.score === null) return;
    const key = `General::${q.topic}`;
    if (topicMap.has(key)) return;
    topicMap.set(key, {
      subject: "General",
      topic: q.topic,
      correct: q.score,
      total: q.questions.length,
    });
  });

  mockTests
    .filter((t) => t.status === "completed")
    .forEach((t) => {
      t.sections.forEach((section) => {
        section.questions.forEach((q) => {
          const key = `${section.name}::${q.topic}`;
          if (topicMap.has(key)) return;
          topicMap.set(key, {
            subject: section.name,
            topic: q.topic || "General",
            correct: t.answers[q.id] === q.answerIndex ? 1 : 0,
            total: 1,
          });
        });
      });
    });

  return Array.from(topicMap.values())
    .filter((t) => t.total > 0)
    .map((t) => ({ ...t, accuracy: Math.round((t.correct / t.total) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

/* ─── Diagnostic question type ───────────────────────────────────────────── */

interface DiagnosticQuestion {
  topic: string;
  subject: string;
  difficulty: Difficulty;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  userAnswer: number | null;
}

/* ─── DiagnosticTestModal ────────────────────────────────────────────────── */

function DiagnosticTestModal({
  weakTopics,
  examName,
  onClose,
  onComplete,
}: {
  weakTopics: { subject: string; topic: string }[];
  examName?: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const qc = useQueryClient();

  // Phase: "intro" | "loading" | "question" | "result"
  const [phase, setPhase] = useState<"intro" | "loading" | "question" | "result">("intro");
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(DIAGNOSTIC_DURATION_SECONDS);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Select up to DIAGNOSTIC_QUESTIONS topics from weakTopics (cycle if fewer)
  const selectedTopics = useRef<{ subject: string; topic: string }[]>([]);

  const savePerfMutation = useMutation({
    mutationFn: api.upsertPerformanceLog,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["perfLogs"] }),
  });

  // Timer
  useEffect(() => {
    if (isTimerActive) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            setPhase("result");
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTimerActive]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const loadNextQuestion = useCallback(
    async (
      allQuestions: DiagnosticQuestion[],
      idx: number,
      nextDifficulty: Difficulty,
    ) => {
      setPhase("loading");
      setSelectedOption(null);
      setRevealed(false);

      // Pick topic for this question (cycle through selected topics)
      const topicEntry = selectedTopics.current[idx % selectedTopics.current.length];

      try {
        const res = await generateQuiz({
          data: {
            topic: topicEntry.topic,
            count: 1,
            difficulty: nextDifficulty,
            examName,
            source: "diagnostic",
          },
        });

        if (!res.questions || res.questions.length === 0) {
          throw new Error("No question returned");
        }

        const raw = res.questions[0];
        const newQ: DiagnosticQuestion = {
          topic: topicEntry.topic,
          subject: topicEntry.subject,
          difficulty: nextDifficulty,
          question: raw.question,
          options: raw.options,
          answerIndex:
            typeof raw.answerIndex === "string"
              ? parseInt(raw.answerIndex, 10)
              : raw.answerIndex,
          explanation: raw.explanation,
          userAnswer: null,
        };

        const updated = [...allQuestions, newQ];
        setQuestions(updated);
        setCurrentIdx(idx);
        setPhase("question");
      } catch {
        toast.error("Failed to load question. Skipping…");
        // Skip this question and move on
        if (idx + 1 < DIAGNOSTIC_QUESTIONS) {
          await loadNextQuestion(allQuestions, idx + 1, nextDifficulty);
        } else {
          setPhase("result");
        }
      }
    },
    [examName],
  );

  const handleStart = useCallback(async () => {
    // Build topic list
    const topics =
      weakTopics.length > 0
        ? weakTopics.slice(0, DIAGNOSTIC_QUESTIONS)
        : [{ subject: "General", topic: "Mixed Topics" }];

    // If fewer topics than questions, cycle
    while (topics.length < DIAGNOSTIC_QUESTIONS) {
      topics.push(...weakTopics.slice(0, DIAGNOSTIC_QUESTIONS - topics.length));
    }
    selectedTopics.current = topics;

    setIsTimerActive(true);
    await loadNextQuestion([], 0, "medium");
  }, [weakTopics, loadNextQuestion]);

  const handleAnswer = (optionIdx: number) => {
    if (revealed) return;
    setSelectedOption(optionIdx);
  };

  const handleReveal = () => {
    if (selectedOption === null) return;
    setRevealed(true);

    // Record answer
    setQuestions((prev) => {
      const updated = [...prev];
      updated[currentIdx] = { ...updated[currentIdx], userAnswer: selectedOption };
      return updated;
    });
  };

  const handleNext = async () => {
    const currentQ = questions[currentIdx];
    const wasCorrect = currentQ.userAnswer === currentQ.answerIndex;

    const nextIdx = currentIdx + 1;

    if (nextIdx >= DIAGNOSTIC_QUESTIONS) {
      // Done — compute results and save
      setIsTimerActive(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPhase("result");
      return;
    }

    // Adaptive difficulty
    const diffIdx = DIFFICULTIES.indexOf(currentQ.difficulty);
    let nextDiff: Difficulty = currentQ.difficulty;
    if (wasCorrect && diffIdx < DIFFICULTIES.length - 1) {
      nextDiff = DIFFICULTIES[diffIdx + 1];
    } else if (!wasCorrect && diffIdx > 0) {
      nextDiff = DIFFICULTIES[diffIdx - 1];
    }

    await loadNextQuestion(questions, nextIdx, nextDiff);
  };

  const handleFinish = async () => {
    // Aggregate results by topic and save performance logs
    const topicResults = new Map<
      string,
      { subject: string; topic: string; correct: number; total: number }
    >();

    questions.forEach((q) => {
      const key = `${q.subject}::${q.topic}`;
      const existing = topicResults.get(key) || {
        subject: q.subject,
        topic: q.topic,
        correct: 0,
        total: 0,
      };
      existing.total++;
      if (q.userAnswer === q.answerIndex) existing.correct++;
      topicResults.set(key, existing);
    });

    // Save to Supabase (fire-and-forget; errors surfaced via toast from mutation)
    for (const [, entry] of topicResults) {
      savePerfMutation.mutate({
        subject: entry.subject,
        topic: entry.topic,
        question_count: entry.total,
        correct_count: entry.correct,
      });
    }

    // Award XP for completing diagnostic
    const correctCount = questions.filter((q) => q.userAnswer === q.answerIndex).length;
    api.awardXP(correctCount * XP_REWARDS.quiz_correct).catch(() => {});

    toast.success("Diagnostic complete! Analytics updated.");
    onComplete();
  };

  const correctCount = questions.filter((q) => q.userAnswer === q.answerIndex).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-fade-up"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" style={{ color: "var(--feat-analytics)" }} />
            <span className="font-bold text-sm">Adaptive Diagnostic Test</span>
            {phase === "question" && (
              <span className="text-xs text-muted-foreground">
                Q{currentIdx + 1}/{DIAGNOSTIC_QUESTIONS}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isTimerActive && (
              <div
                className="flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: secondsLeft < 300 ? "var(--destructive)" : "var(--muted)",
                  color: secondsLeft < 300 ? "white" : "var(--foreground)",
                }}
              >
                <Clock size={11} />
                {formatTime(secondsLeft)}
              </div>
            )}
            <button
              onClick={onClose}
              className="h-7 w-7 rounded-full grid place-items-center hover:bg-muted transition-colors"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {phase === "question" && (
          <div className="h-1 bg-muted">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${((currentIdx + 1) / DIAGNOSTIC_QUESTIONS) * 100}%`,
                background: "var(--feat-analytics)",
              }}
            />
          </div>
        )}

        {/* Body */}
        <div className="p-6">
          {/* ── Intro ── */}
          {phase === "intro" && (
            <div className="text-center py-4">
              <div
                className="h-16 w-16 rounded-2xl grid place-items-center mx-auto mb-4 shadow-glow-sm"
                style={{ background: "var(--feat-analytics-bg)", border: "1px solid var(--feat-analytics)" }}
              >
                <FlaskConical className="h-8 w-8" style={{ color: "var(--feat-analytics)" }} />
              </div>
              <h2 className="text-xl font-bold font-heading mb-2">Adaptive Diagnostic Test</h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                {weakTopics.length > 0
                  ? `${DIAGNOSTIC_QUESTIONS} questions drawn from your ${weakTopics.length} weakest topic${weakTopics.length > 1 ? "s" : ""}. Difficulty adapts after each answer.`
                  : `${DIAGNOSTIC_QUESTIONS} mixed questions across various topics. Difficulty adapts based on your performance.`}
              </p>
              <div className="grid grid-cols-3 gap-3 mb-8 max-w-sm mx-auto">
                {[
                  { label: "Questions", value: DIAGNOSTIC_QUESTIONS },
                  { label: "Max Time", value: "60 min" },
                  { label: "Adaptive", value: "Yes" },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="p-3 rounded-xl text-center"
                    style={{ background: "var(--muted)" }}
                  >
                    <div className="font-bold text-lg">{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
              {weakTopics.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs text-muted-foreground mb-2">Topics in this test:</p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {weakTopics.slice(0, 6).map((t) => (
                      <span
                        key={`${t.subject}-${t.topic}`}
                        className="px-2.5 py-1 rounded-full text-xs"
                        style={{
                          background: "var(--destructive)/10",
                          color: "var(--destructive)",
                          border: "1px solid var(--destructive)/20",
                        }}
                      >
                        {t.topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <Button
                onClick={handleStart}
                className="bg-gradient-primary shadow-glow px-8 h-11 text-sm font-semibold"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Diagnostic
              </Button>
            </div>
          )}

          {/* ── Loading ── */}
          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div
                className="h-12 w-12 rounded-xl grid place-items-center animate-pulse"
                style={{ background: "var(--feat-analytics-bg)" }}
              >
                <Brain className="h-6 w-6" style={{ color: "var(--feat-analytics)" }} />
              </div>
              <p className="text-sm text-muted-foreground">
                Generating question {currentIdx + 1} of {DIAGNOSTIC_QUESTIONS}…
              </p>
            </div>
          )}

          {/* ── Question ── */}
          {phase === "question" && questions[currentIdx] && (() => {
            const q = questions[currentIdx];
            return (
              <div>
                {/* Meta */}
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium capitalize"
                    style={{
                      background:
                        q.difficulty === "easy"
                          ? "rgba(34,197,94,0.1)"
                          : q.difficulty === "hard"
                            ? "rgba(239,68,68,0.1)"
                            : "rgba(245,158,11,0.1)",
                      color:
                        q.difficulty === "easy"
                          ? "#22c55e"
                          : q.difficulty === "hard"
                            ? "#ef4444"
                            : "#f59e0b",
                    }}
                  >
                    {q.difficulty}
                  </span>
                  <span className="text-xs text-muted-foreground">{q.subject} · {q.topic}</span>
                </div>

                {/* Question text */}
                <p className="text-base font-medium leading-relaxed mb-5">{q.question}</p>

                {/* Options */}
                <div className="space-y-2 mb-5">
                  {q.options.map((opt, i) => {
                    const isSelected = selectedOption === i;
                    const isCorrect = i === q.answerIndex;
                    const isWrong = revealed && isSelected && !isCorrect;
                    const isRevealedCorrect = revealed && isCorrect;

                    return (
                      <button
                        key={i}
                        onClick={() => handleAnswer(i)}
                        disabled={revealed}
                        className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all border"
                        style={{
                          background: isRevealedCorrect
                            ? "rgba(34,197,94,0.1)"
                            : isWrong
                              ? "rgba(239,68,68,0.1)"
                              : isSelected
                                ? "var(--feat-analytics-bg)"
                                : "var(--muted)",
                          borderColor: isRevealedCorrect
                            ? "#22c55e"
                            : isWrong
                              ? "#ef4444"
                              : isSelected
                                ? "var(--feat-analytics)"
                                : "var(--border)",
                          color: isRevealedCorrect
                            ? "#22c55e"
                            : isWrong
                              ? "#ef4444"
                              : "var(--foreground)",
                          cursor: revealed ? "default" : "pointer",
                        }}
                      >
                        <span className="font-semibold mr-2">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {revealed && (
                  <div
                    className="p-3 rounded-xl text-sm mb-4"
                    style={{ background: "var(--muted)", borderLeft: "3px solid var(--feat-analytics)" }}
                  >
                    <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wide block mb-1">
                      Explanation
                    </span>
                    {q.explanation}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex justify-end gap-2">
                  {!revealed ? (
                    <Button
                      onClick={handleReveal}
                      disabled={selectedOption === null}
                      className="bg-gradient-primary shadow-glow h-9 px-5 text-sm"
                    >
                      Check Answer
                    </Button>
                  ) : (
                    <Button
                      onClick={handleNext}
                      className="bg-gradient-primary shadow-glow h-9 px-5 text-sm"
                    >
                      {currentIdx + 1 < DIAGNOSTIC_QUESTIONS ? (
                        <>Next <ChevronRight size={15} /></>
                      ) : (
                        "See Results"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Results ── */}
          {phase === "result" && (
            <div>
              <div className="text-center mb-6">
                <div
                  className={cn(
                    "h-16 w-16 rounded-2xl grid place-items-center mx-auto mb-3 text-2xl font-bold",
                    correctCount >= Math.ceil(DIAGNOSTIC_QUESTIONS * 0.7)
                      ? "bg-success/10 text-success"
                      : correctCount >= Math.ceil(DIAGNOSTIC_QUESTIONS * 0.4)
                        ? "bg-warning/10 text-warning"
                        : "bg-destructive/10 text-destructive",
                  )}
                >
                  {Math.round((correctCount / Math.max(questions.length, 1)) * 100)}%
                </div>
                <h2 className="text-xl font-bold font-heading mb-1">Diagnostic Complete</h2>
                <p className="text-sm text-muted-foreground">
                  {correctCount} / {questions.length} correct
                </p>
              </div>

              {/* Per-question breakdown */}
              <div className="space-y-2 mb-6 max-h-56 overflow-y-auto pr-1">
                {questions.map((q, i) => {
                  const correct = q.userAnswer === q.answerIndex;
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-xl text-sm"
                      style={{ background: "var(--muted)" }}
                    >
                      <div
                        className={cn(
                          "h-5 w-5 rounded-full grid place-items-center shrink-0 mt-0.5",
                          correct ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive",
                        )}
                      >
                        {correct ? <CheckCircle2 size={12} /> : <X size={12} />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{q.question}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {q.subject} · {q.topic} ·{" "}
                          <span className="capitalize">{q.difficulty}</span>
                        </p>
                        {!correct && q.userAnswer !== null && (
                          <p className="text-xs text-destructive mt-0.5">
                            Your answer: {q.options[q.userAnswer]} · Correct: {q.options[q.answerIndex]}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm rounded-xl border transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                >
                  Close
                </button>
                <Button
                  onClick={handleFinish}
                  className="bg-gradient-primary shadow-glow h-9 px-5 text-sm"
                >
                  Save & Update Analytics
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main analytics page ─────────────────────────────────────────────────── */

function AnalyticsPage() {
  const { data: quizzes = [] } = useQuery({ queryKey: ["quizzes"], queryFn: api.getQuizzes });
  const { data: mockTests = [] } = useQuery({ queryKey: ["mockTests"], queryFn: api.getMockTests });
  const { data: perfLogs = [] } = useQuery({
    queryKey: ["perfLogs"],
    queryFn: api.getPerformanceLogs,
  });
  const { data: profile } = useQuery({ queryKey: ["userProfile"], queryFn: api.getUserProfile });
  const { triggerPageTour } = useTutorial();

  useEffect(() => {
    triggerPageTour("analytics");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [diagnosticCompleted, setDiagnosticCompleted] = useState(false);

  const examInfo = profile?.exam_id ? getExamById(profile.exam_id) : null;
  const trendData = computeQuizTrend(quizzes, mockTests);
  const topicData = computeTopicMastery(quizzes, mockTests, perfLogs);
  const weakTopics = topicData.filter((t) => t.accuracy < 50).slice(0, 6);
  const strongTopics = topicData
    .filter((t) => t.accuracy >= 70)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5);

  const completedMocks = mockTests.filter((t) => t.status === "completed");
  const attemptedQuizzes = quizzes.filter((q) => q.score !== undefined && q.score !== null);
  const totalQuizzes = attemptedQuizzes.length;
  const totalMocks = completedMocks.length;
  const totalAttempts = totalQuizzes + totalMocks;
  const totalQuestions =
    attemptedQuizzes.reduce((s, q) => s + q.questions.length, 0) +
    completedMocks.reduce(
      (s, t) => s + t.sections.reduce((ss, sec) => ss + sec.questions.length, 0),
      0,
    );

  const overallAccuracy = (() => {
    if (topicData.length > 0) {
      const totalCorrect = topicData.reduce((s, t) => s + t.correct, 0);
      const totalAttempted = topicData.reduce((s, t) => s + t.total, 0);
      return totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    }
    if (attemptedQuizzes.length > 0) {
      const totalCorrect = attemptedQuizzes.reduce((s, q) => s + (q.score ?? 0), 0);
      const totalAttempted = attemptedQuizzes.reduce((s, q) => s + q.questions.length, 0);
      return totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    }
    return 0;
  })();

  const recentScores = trendData.slice(-5);
  const trend =
    recentScores.length >= 2
      ? recentScores[recentScores.length - 1].score - recentScores[0].score
      : 0;

  const subjectGroups = new Map<string, typeof topicData>();
  topicData.forEach((t) => {
    const arr = subjectGroups.get(t.subject) || [];
    arr.push(t);
    subjectGroups.set(t.subject, arr);
  });

  // Show full analytics if user has 5+ attempts OR completed the diagnostic
  const hasEnoughData = totalAttempts >= MIN_ATTEMPTS_FOR_FULL_ANALYTICS || diagnosticCompleted;

  return (
    <div className="relative min-h-full">
      <div className="relative max-w-6xl mx-auto px-6 py-10 animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight font-heading">
          <span className="text-gradient">Analytics</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          {examInfo
            ? `Performance overview for ${examInfo.name}`
            : "Track your exam prep performance"}
        </p>

        {!hasEnoughData ? (
          /* ── Empty / low-data state ── */
          <div className="mt-8 space-y-6">
            {/* Motivational empty card */}
            <div
              className="rounded-3xl p-8 md:p-12 text-center relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, var(--feat-analytics-bg) 0%, var(--card) 60%)",
                border: "1px solid var(--feat-analytics)",
              }}
            >
              {/* Decorative blobs */}
              <div
                className="absolute -top-8 -right-8 h-40 w-40 rounded-full opacity-10 pointer-events-none"
                style={{ background: "var(--feat-analytics)" }}
              />
              <div
                className="absolute -bottom-12 -left-12 h-52 w-52 rounded-full opacity-5 pointer-events-none"
                style={{ background: "var(--feat-analytics)" }}
              />

              <div className="relative">
                <div
                  className="h-16 w-16 rounded-2xl grid place-items-center mx-auto mb-5 shadow-glow-sm"
                  style={{
                    background: "var(--feat-analytics-bg)",
                    border: "1px solid var(--feat-analytics)",
                  }}
                >
                  <BarChart3 className="h-8 w-8" style={{ color: "var(--feat-analytics)" }} />
                </div>
                <h2 className="text-2xl font-bold font-heading mb-3">
                  Not enough data yet
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-2">
                  You need at least{" "}
                  <span className="font-semibold text-foreground">
                    {MIN_ATTEMPTS_FOR_FULL_ANALYTICS} quiz or mock test attempts
                  </span>{" "}
                  to unlock full analytics. You've completed{" "}
                  <span className="font-semibold text-foreground">{totalAttempts}</span> so far.
                </p>
                <p className="text-sm text-muted-foreground mb-8">
                  Or, take the Adaptive Diagnostic Test below — it counts too!
                </p>

                {/* Progress bar */}
                <div className="max-w-xs mx-auto mb-8">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{totalAttempts} attempts</span>
                    <span>{MIN_ATTEMPTS_FOR_FULL_ANALYTICS} needed</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, (totalAttempts / MIN_ATTEMPTS_FOR_FULL_ANALYTICS) * 100)}%`,
                        background: "var(--feat-analytics)",
                      }}
                    />
                  </div>
                </div>

                {/* Quick links */}
                <div className="flex flex-wrap gap-3 justify-center mb-8">
                  <Link to="/quiz">
                    <button
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border transition-all hover:scale-105"
                      style={{ borderColor: "var(--border)", background: "var(--muted)" }}
                    >
                      <Brain size={15} style={{ color: "var(--feat-quiz)" }} />
                      Take a Quiz
                    </button>
                  </Link>
                  <Link to="/mock-test">
                    <button
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border transition-all hover:scale-105"
                      style={{ borderColor: "var(--border)", background: "var(--muted)" }}
                    >
                      <BookOpen size={15} style={{ color: "var(--feat-mock)" }} />
                      Mock Test
                    </button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Diagnostic test CTA card */}
            <div
              className="rounded-2xl p-6 flex flex-col md:flex-row items-center gap-5"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div
                className="h-14 w-14 shrink-0 rounded-xl grid place-items-center"
                style={{ background: "var(--feat-analytics-bg)" }}
              >
                <FlaskConical className="h-7 w-7" style={{ color: "var(--feat-analytics)" }} />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="font-bold text-base mb-1">Take the Adaptive Diagnostic Test</h3>
                <p className="text-sm text-muted-foreground">
                  6 questions · difficulty adapts after each answer · results unlock detailed topic analysis
                </p>
              </div>
              <Button
                onClick={() => setShowDiagnostic(true)}
                className="shrink-0 bg-gradient-primary shadow-glow px-6 h-10 text-sm"
              >
                <Sparkles size={14} className="mr-2" />
                Start Diagnostic
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Diagnostic test CTA (small, above main charts) ── */}
            <div
              className="mt-6 flex items-center gap-3 p-4 rounded-2xl"
              style={{ background: "var(--feat-analytics-bg)", border: "1px solid var(--feat-analytics)" }}
            >
              <FlaskConical className="h-5 w-5 shrink-0" style={{ color: "var(--feat-analytics)" }} />
              <div className="flex-1 text-sm">
                <span className="font-semibold">Adaptive Diagnostic Test</span>
                <span className="text-muted-foreground ml-2">
                  — identify blind spots with {DIAGNOSTIC_QUESTIONS} targeted questions
                </span>
              </div>
              <button
                onClick={() => setShowDiagnostic(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-105"
                style={{
                  background: "var(--feat-analytics)",
                  color: "white",
                }}
              >
                <Play size={11} />
                Run Test
              </button>
            </div>

            {/* Stat cards */}
            <div
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6"
              data-tour="tour-analytics-overview"
            >
              <StatCard
                label="Overall accuracy"
                value={`${overallAccuracy}%`}
                icon={<Target className="h-4 w-4" />}
                accent={
                  overallAccuracy >= 70
                    ? "success"
                    : overallAccuracy >= 40
                      ? "warning"
                      : "destructive"
                }
              />
              <StatCard
                label="Questions practiced"
                value={`${totalQuestions}`}
                icon={<Brain className="h-4 w-4" />}
                accent="primary"
              />
              <StatCard
                label="Quizzes / Mocks"
                value={`${totalQuizzes} / ${totalMocks}`}
                icon={<Zap className="h-4 w-4" />}
                accent="accent"
              />
              <StatCard
                label="Score trend"
                value={`${trend >= 0 ? "+" : ""}${trend}%`}
                icon={
                  trend >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )
                }
                accent={trend >= 0 ? "success" : "destructive"}
              />
            </div>

            {/* Score trend chart */}
            {trendData.length >= 2 && (
              <div className="card-light p-6 rounded-2xl mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Score Trend</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--feat-analytics)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--feat-analytics)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="date"
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                          fontSize: 12,
                          color: "var(--foreground)",
                        }}
                        formatter={(v: number) => [`${v}%`, "Score"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="var(--feat-analytics)"
                        strokeWidth={2}
                        fill="url(#scoreGradient)"
                        dot={{ fill: "var(--feat-analytics)", strokeWidth: 0, r: 3 }}
                        activeDot={{
                          r: 5,
                          fill: "var(--feat-analytics)",
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Topic mastery heatmap + Weak areas */}
            <div className="grid lg:grid-cols-3 gap-4 mt-6">
              {/* Heatmap */}
              <div
                className="lg:col-span-2 card-light p-6 rounded-2xl"
                data-tour="tour-analytics-subjects"
              >
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Topic Mastery</span>
                </div>

                {Array.from(subjectGroups.entries()).map(([subject, topics]) => (
                  <div key={subject} className="mb-4 last:mb-0">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {subject}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {topics.map((t) => (
                        <div
                          key={`${t.subject}-${t.topic}`}
                          title={`${t.topic}: ${t.accuracy}% (${t.correct}/${t.total})`}
                          className={cn(
                            "px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-default transition-all hover:scale-105",
                            t.accuracy >= 80
                              ? "bg-success/15 text-success border border-success/20"
                              : t.accuracy >= 60
                                ? "bg-primary/15 text-primary border border-primary/20"
                                : t.accuracy >= 40
                                  ? "bg-warning/15 text-warning border border-warning/20"
                                  : "bg-destructive/15 text-destructive border border-destructive/20",
                          )}
                        >
                          {t.topic.length > 20 ? t.topic.slice(0, 18) + "…" : t.topic}
                          <span className="ml-1 opacity-70">{t.accuracy}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {topicData.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-6">
                    Complete quizzes and mock tests to see topic mastery data.
                  </div>
                )}

                {/* Legend */}
                {topicData.length > 0 && (
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded bg-success/40" /> ≥80%
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded bg-primary/40" /> 60-79%
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded bg-warning/40" /> 40-59%
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded bg-destructive/40" /> &lt;40%
                    </span>
                  </div>
                )}
              </div>

              {/* Weak + Strong areas */}
              <div className="space-y-4">
                {/* Weak areas */}
                <div className="card-light p-5 rounded-2xl">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="font-semibold text-sm">Needs Attention</span>
                    {weakTopics.length > 0 && (
                      <button
                        onClick={() => setShowDiagnostic(true)}
                        className="ml-auto text-xs px-2 py-0.5 rounded-full transition-colors hover:opacity-80"
                        style={{
                          background: "var(--feat-analytics-bg)",
                          color: "var(--feat-analytics)",
                        }}
                        title="Run diagnostic on weak topics"
                      >
                        <RotateCcw size={10} className="inline mr-1" />
                        Test these
                      </button>
                    )}
                  </div>
                  {weakTopics.length > 0 ? (
                    <div className="space-y-2">
                      {weakTopics.map((t) => (
                        <div
                          key={`${t.subject}-${t.topic}`}
                          className="flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{t.topic}</div>
                            <div className="text-xs text-muted-foreground">{t.subject}</div>
                          </div>
                          <span className="text-sm font-bold text-destructive shrink-0 ml-2">
                            {t.accuracy}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No weak topics detected — great job!
                    </div>
                  )}
                </div>

                {/* Strong areas */}
                <div className="card-light p-5 rounded-2xl">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="font-semibold text-sm">Strong Topics</span>
                  </div>
                  {strongTopics.length > 0 ? (
                    <div className="space-y-2">
                      {strongTopics.map((t) => (
                        <div
                          key={`${t.subject}-${t.topic}`}
                          className="flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{t.topic}</div>
                            <div className="text-xs text-muted-foreground">{t.subject}</div>
                          </div>
                          <span className="text-sm font-bold text-success shrink-0 ml-2">
                            {t.accuracy}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Keep practicing to identify your strengths.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mock test history */}
            {completedMocks.length > 0 && (
              <div className="card-light p-6 rounded-2xl mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Mock Test History</span>
                </div>
                <div className="space-y-2">
                  {completedMocks.slice(0, 8).map((t) => {
                    const pct = t.total_marks
                      ? Math.round(((t.score ?? 0) / t.total_marks) * 100)
                      : 0;
                    const mins = t.time_taken_seconds ? Math.round(t.time_taken_seconds / 60) : 0;
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                        style={{ cursor: "default" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                      >
                        <div
                          className={cn(
                            "h-10 w-10 rounded-lg grid place-items-center text-sm font-bold font-heading",
                            pct >= 70
                              ? "bg-success/10 text-success"
                              : pct >= 40
                                ? "bg-warning/10 text-warning"
                                : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {pct}%
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{t.exam_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {t.score}/{t.total_marks} · {mins}m ·{" "}
                            {t.created_at
                              ? formatTimestampIST(t.created_at, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {t.sections.length} sections
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Diagnostic modal */}
      {showDiagnostic && (
        <DiagnosticTestModal
          weakTopics={weakTopics}
          examName={examInfo?.name ?? profile?.exam_name ?? undefined}
          onClose={() => setShowDiagnostic(false)}
          onComplete={() => {
            setShowDiagnostic(false);
            setDiagnosticCompleted(true);
          }}
        />
      )}
    </div>
  );
}

/* ─── StatCard ────────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "primary" | "accent" | "success" | "warning" | "destructive";
}) {
  const colorMap = {
    primary: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
    accent: { bg: "bg-accent/10", text: "text-accent", border: "border-accent/20" },
    success: { bg: "bg-success/10", text: "text-success", border: "border-success/20" },
    warning: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20" },
    destructive: {
      bg: "bg-destructive/10",
      text: "text-destructive",
      border: "border-destructive/20",
    },
  };
  const c = colorMap[accent];
  return (
    <div className="card-light p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted-foreground font-medium">{label}</div>
        <div
          className={`h-8 w-8 rounded-lg ${c.bg} ${c.text} grid place-items-center border ${c.border}`}
        >
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold font-heading">{value}</div>
    </div>
  );
}
