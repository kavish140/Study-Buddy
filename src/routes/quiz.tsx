import { createFileRoute } from "@tanstack/react-router";
import { todayIST } from "@/lib/date-utils";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, RotateCcw, Check, X } from "lucide-react";
import { uid, XP_REWARDS, type SavedQuiz, type QuizQuestion } from "@/lib/storage";
import { generateQuiz } from "@/lib/ai.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTutorial } from "@/components/TutorialProvider";
import { MarkdownContent } from "@/components/MarkdownContent";

export const Route = createFileRoute("/quiz")({
  head: () => ({
    meta: [
      { title: "Quizzes — AcePrep" },
      {
        name: "description",
        content: "Generate AI quizzes on any topic and review your past attempts.",
      },
    ],
  }),
  component: QuizPage,
});

function QuizPage() {
  const queryClient = useQueryClient();
  const { data: quizzes = [], isError: quizzesError } = useQuery({
    queryKey: ["quizzes"],
    queryFn: api.getQuizzes,
  });
  const { data: profile } = useQuery({ queryKey: ["userProfile"], queryFn: api.getUserProfile });
  const { triggerPageTour } = useTutorial();

  useEffect(() => {
    triggerPageTour("quiz");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: api.saveQuiz,
    onError: (error) => toast.error(error.message || "Operation failed"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quizzes"] }),
  });
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("5");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("hard");
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<SavedQuiz | null>(null);

  const handleGenerate = async (retryCount = 0) => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const res = await generateQuiz({
        data: {
          topic,
          count: Number(count),
          difficulty,
          examName: profile?.exam_name,
          source: "quiz",
        },
      });

      // Defensive: ensure AI returned a valid non-empty questions array
      if (!Array.isArray(res.questions) || res.questions.length === 0) {
        throw new Error("AI returned an empty quiz — please try again.");
      }

      // Defensive: coerce answerIndex to number in case AI returns a string
      const questions: QuizQuestion[] = res.questions.map((q: QuizQuestion) => ({
        ...q,
        answerIndex: typeof q.answerIndex === "string" ? parseInt(q.answerIndex, 10) : q.answerIndex,
      }));

      const quiz: SavedQuiz = {
        id: uid(),
        topic: topic.trim(),
        createdAt: Date.now(),
        questions,
      };

      // Fire-and-forget save — don't block quiz activation if the initial DB write
      // fails (e.g. network blip). The score-save upsert in saveScore will
      // re-insert the quiz+score as a fallback if this silent save failed.
      saveMutation.mutate(quiz);
      setActive(quiz);
      setTopic("");
    } catch (e) {
      // Only catches quiz GENERATION errors (edge function failures), not save errors.
      // Save errors are surfaced via saveMutation’s top-level onError toast.
      const msg = e instanceof Error ? e.message : "Failed to generate quiz";
      toast.error(msg, {
        action:
          retryCount < 2
            ? {
                label: "Retry",
                onClick: () => handleGenerate(retryCount + 1),
              }
            : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const saveScore = (quiz: SavedQuiz, score: number) => {
    // Upsert the quiz with the final score. If the initial fire-and-forget save in
    // handleGenerate failed, this acts as a fallback INSERT of the quiz+score.
    saveMutation.mutate(
      { ...quiz, score },
      {
        onSuccess: () => toast.success(`Quiz saved! Score: ${score}/${quiz.questions.length}`),
        // No per-call onError here — the top-level saveMutation onError handles it
        // to avoid showing two error toasts for the same failure.
      },
    );

    // Award XP for correct answers (fire-and-forget; non-blocking).
    const isPerfect = score === quiz.questions.length;
    api.awardXP(score * XP_REWARDS.quiz_correct, { quizPerfect: isPerfect }).catch(() => {});
  };

  if (active) {
    return (
      <QuizRunner
        quiz={active}
        onFinish={(s) => saveScore(active, s)}
        onClose={() => setActive(null)}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 animate-fade-up">
      <h1 className="text-3xl font-bold tracking-tight font-heading">AI Quizzer</h1>
      <p className="text-muted-foreground mt-1">
        Generate a{" "}
        {profile?.exam_name ? (
          <span className="text-primary font-medium">{profile.exam_name}</span>
        ) : (
          "competitive exam"
        )}
        -level quiz on any syllabus topic.
      </p>

      <div className="p-5 rounded-2xl card-light mt-6" data-tour="tour-quiz-topic">
        <div className="flex items-center gap-2 text-sm font-medium mb-4">
          <Sparkles className="h-4 w-4 text-primary" /> New quiz
        </div>
        <div
          className="grid md:grid-cols-[1fr_120px_140px_auto] gap-2"
          data-tour="tour-quiz-settings"
        >
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={
              profile?.exam_name
                ? `${profile.exam_name} topic, e.g. Projectile Motion, p-Block Elements...`
                : "Topic, e.g. Newton's laws of motion"
            }
            onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
          />
          <Select value={count} onValueChange={setCount}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[3, 5, 8, 10, 15].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} questions
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy (NCERT)</SelectItem>
              <SelectItem value="medium">Medium (JEE Main)</SelectItem>
              <SelectItem value="hard">Hard (JEE Advanced)</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => handleGenerate()}
            disabled={loading || !topic.trim()}
            className="bg-gradient-primary"
            data-tour="tour-quiz-generate"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
          </Button>
        </div>
      </div>

      <h2 className="text-sm font-medium text-muted-foreground mt-8 mb-3">Past quizzes</h2>
      {quizzesError ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-destructive/30 rounded-xl">
          <p className="text-destructive text-sm font-medium mb-1">Failed to load past quizzes</p>
          <p className="text-xs">Check your connection and refresh the page.</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
          No quizzes yet. Generate one above to get started.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {quizzes.map((q) => (
            <div
              key={q.id}
              className="p-4 rounded-2xl card-light flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{q.topic}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {q.questions.length} questions
                  {q.score != null && ` · scored ${q.score}/${q.questions.length}`}
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setActive(q)}>
                Retake
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuizRunner({
  quiz,
  onFinish,
  onClose,
}: {
  quiz: SavedQuiz;
  onFinish: (score: number) => void;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = quiz.questions.reduce((s, q, i) => s + (answers[i] === q.answerIndex ? 1 : 0), 0);

  const handleSubmit = () => {
    setSubmitted(true);
    onFinish(score);

    // Auto-save wrong answers as spaced-repetition review cards
    const wrongCards = quiz.questions
      .filter((q, i) => answers[i] !== q.answerIndex)
      .map((q) => ({
        question: q.question,
        answer: q.options[q.answerIndex],
        explanation: q.explanation || undefined,
        subject: quiz.topic,
        source: "quiz" as const,
        ease_factor: 2.5,
        interval_days: 1,
        repetitions: 0,
        next_review: todayIST(),
      }));
    if (wrongCards.length > 0) {
      api.saveReviewCards(wrongCards).catch(() => {});
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Quiz</div>
          <h1 className="text-2xl font-semibold tracking-tight">{quiz.topic}</h1>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        {quiz.questions.map((q: QuizQuestion, i) => (
          <div key={i} className="p-5 rounded-2xl card-light">
            <div className="text-xs text-muted-foreground mb-1">Question {i + 1}</div>
            {/* Question text — MarkdownContent renders inline LaTeX like $\sin x$ */}
            <div className="font-medium text-sm leading-relaxed">
              <MarkdownContent content={q.question} />
            </div>
            <div className="grid gap-2 mt-3">
              {q.options.map((opt, oi) => {
                const chosen = answers[i] === oi;
                const correct = q.answerIndex === oi;
                const showState = submitted;
                return (
                  // Using div[role=button] instead of <button> so that MarkdownContent's
                  // block-level elements (e.g. display math <div>) are valid HTML children.
                  <div
                    key={oi}
                    role="button"
                    tabIndex={submitted ? -1 : 0}
                    aria-pressed={chosen}
                    aria-disabled={submitted}
                    onClick={() => !submitted && setAnswers({ ...answers, [i]: oi })}
                    onKeyDown={(e) =>
                      !submitted &&
                      (e.key === "Enter" || e.key === " ") &&
                      setAnswers({ ...answers, [i]: oi })
                    }
                    className={cn(
                      "text-left px-4 py-2.5 rounded-lg border text-sm transition-colors select-none",
                      !submitted && "cursor-pointer",
                      submitted && "cursor-default",
                      !showState && chosen && "border-[color:var(--feat-quiz)]",
                      !showState && !chosen && "border-border hover:border-primary/50",
                      showState && correct && "border-[color:var(--feat-quiz)]",
                      showState && chosen && !correct && "border-[#ef4444]",
                      showState && !chosen && !correct && "border-border opacity-60",
                    )}
                    style={{
                      background:
                        !showState && chosen
                          ? "var(--feat-quiz-bg)"
                          : showState && correct
                            ? "var(--feat-quiz-bg)"
                            : showState && chosen && !correct
                              ? "rgba(239,68,68,0.1)"
                              : undefined,
                      color:
                        !showState && chosen
                          ? "var(--feat-quiz)"
                          : showState && correct
                            ? "var(--feat-quiz)"
                            : showState && chosen && !correct
                              ? "#ef4444"
                              : undefined,
                    }}
                  >
                    <span className="inline-flex items-start gap-2">
                      <span className="shrink-0 mt-0.5">
                        {showState && correct && <Check className="h-4 w-4" />}
                        {showState && chosen && !correct && <X className="h-4 w-4" />}
                        {(!showState || (!correct && !chosen)) && (
                          <span className="text-xs font-bold opacity-50">
                            {String.fromCharCode(65 + oi)}.
                          </span>
                        )}
                      </span>
                      {/* Option text — MarkdownContent renders inline LaTeX */}
                      <span className="flex-1">
                        <MarkdownContent content={opt} />
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            {submitted && (
              <div className="mt-3 border-t border-border pt-3">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  Explanation
                </span>
                <div className="mt-1.5 text-sm text-muted-foreground">
                  <MarkdownContent content={q.explanation || ""} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 mt-6 p-4 border-t border-border flex items-center justify-between" style={{ background: "var(--background)" }}>
        {submitted ? (
          <>
            <div className="font-medium">
              Score:{" "}
              <span className="text-gradient text-lg">
                {score}/{quiz.questions.length}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setAnswers({});
                  setSubmitted(false);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-1" /> Retry
              </Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              {Object.keys(answers).length}/{quiz.questions.length} answered
            </div>
            <Button
              onClick={handleSubmit}
              disabled={Object.keys(answers).length !== quiz.questions.length}
              className="bg-gradient-primary"
            >
              Submit
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
