import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { todayIST } from "@/lib/date-utils";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type ReviewCard, XP_REWARDS } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTutorial } from "@/components/TutorialProvider";
import { MarkdownContent } from "@/components/MarkdownContent";
import {
  Brain,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
  CalendarCheck,
  Sparkles,
  BookOpen,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Smart Review · AcePrep" },
      { name: "description", content: "Spaced repetition flashcards from your wrong answers" },
    ],
  }),
  component: ReviewPage,
});

/* ─── Rating button config ─── */
const RATINGS = [
  {
    label: "Again",
    value: 0 as const,
    color: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100",
    emoji: "🔴",
    hint: "< 1 day",
  },
  {
    label: "Hard",
    value: 1 as const,
    color: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
    emoji: "🟡",
    hint: "1 day",
  },
  {
    label: "Good",
    value: 3 as const,
    color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
    emoji: "🔵",
    hint: "few days",
  },
  {
    label: "Easy",
    value: 5 as const,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    emoji: "🟢",
    hint: "long",
  },
];

type ReviewMode = "flashcard" | "quiz";

function ReviewPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { triggerPageTour } = useTutorial();

  useEffect(() => {
    triggerPageTour("review");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: allCards = [], isLoading } = useQuery({
    queryKey: ["reviewCards"],
    queryFn: api.getDueReviewCards,
  });

  const { data: totalCards = [] } = useQuery({
    queryKey: ["allReviewCards"],
    queryFn: api.getReviewCards,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: 0 | 1 | 3 | 5 }) =>
      api.updateReviewCard(id, rating),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviewCards"] });
      qc.invalidateQueries({ queryKey: ["allReviewCards"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteReviewCard,
    onError: (error) => toast.error(error.message || "Operation failed"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviewCards"] });
      qc.invalidateQueries({ queryKey: ["allReviewCards"] });
    },
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionCards, setSessionCards] = useState<ReviewCard[]>([]);
  const [mode, setMode] = useState<ReviewMode>("flashcard");

  // Quiz mode state
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [quizRevealed, setQuizRevealed] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  useEffect(() => {
    if (allCards.length === 0) return;
    if (sessionCards.length > 0) return;
    setSessionCards([...allCards]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setQuizSelected(null);
    setQuizRevealed(false);
    setDoneCount(0);
    setSessionComplete(false);
  }, [allCards]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentCard = sessionCards[currentIndex];
  const sessionTotal = sessionCards.length || allCards.length;
  const progress = sessionTotal > 0 ? (doneCount / sessionTotal) * 100 : 0;

  // Determine if current card supports quiz mode (has MCQ options from a failed quiz/mock test)
  const cardHasOptions = !!(currentCard?.options && currentCard.options.length > 0 && currentCard.correctOptionIndex !== undefined);
  const effectiveMode: ReviewMode = mode === "quiz" && cardHasOptions ? "quiz" : "flashcard";

  const advanceCard = async (rating: 0 | 1 | 3 | 5) => {
    if (!currentCard) return;
    try {
      await updateMutation.mutateAsync({ id: currentCard.id, rating });
      api.awardXP(XP_REWARDS.review_card, { reviewCount: doneCount + 1 }).catch(() => {});
      const next = currentIndex + 1;
      setDoneCount((d) => d + 1);
      setQuizSelected(null);
      setQuizRevealed(false);
      setIsFlipped(false);
      if (next >= sessionCards.length) {
        setSessionComplete(true);
        setSessionCards([]);
      } else {
        setCurrentIndex(next);
      }
    } catch {
      toast.error("Failed to save rating. Please try again.");
    }
  };

  const handleRate = (rating: 0 | 1 | 3 | 5) => advanceCard(rating);

  const handleQuizSelect = (idx: number) => {
    if (quizRevealed) return;
    const correct = idx === currentCard?.correctOptionIndex;
    if (correct) setQuizScore((s) => s + 1);
    setQuizSelected(idx);
    setQuizRevealed(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Brain className="h-12 w-12 text-primary/30 mx-auto mb-3 animate-pulse" />
          <p className="text-muted-foreground">Loading your review cards…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow-sm">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-heading">Smart Review</h1>
              <p className="text-sm text-muted-foreground">Spaced repetition · SM-2 algorithm</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex items-center rounded-xl border border-border p-0.5 gap-0.5" style={{ background: "var(--muted)" }}>
              <button
                onClick={() => setMode("flashcard")}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-lg font-medium transition-all",
                  mode === "flashcard" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Flashcard
              </button>
              <button
                onClick={() => setMode("quiz")}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-lg font-medium transition-all flex items-center gap-1",
                  mode === "quiz" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Zap className="h-3 w-3" />
                Quiz
              </button>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:border-primary/30 transition-colors"
              style={{ background: "var(--muted)" }}
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>

        {/* Mode hint */}
        {mode === "quiz" && (
          <p className="text-xs text-muted-foreground mt-2 px-1">
            <span className="text-primary font-medium">Quiz Mode:</span> Cards with MCQ options from failed quizzes/mock tests will appear as interactive questions.
          </p>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-6" data-tour="tour-review-cards">
          {[
            { label: "Due today", value: allCards.length, icon: CalendarCheck, color: "text-primary" },
            { label: "Total cards", value: totalCards.length, icon: BookOpen, color: "text-primary" },
            { label: "Done today", value: doneCount, icon: CheckCircle2, color: "text-emerald-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card-light rounded-xl p-4 text-center">
              <Icon className={cn("h-5 w-5 mx-auto mb-1", color)} />
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {allCards.length > 0 && (
          <div className="mt-4 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
            <div
              className="h-full bg-gradient-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Session complete */}
      {sessionComplete && (
        <div className="card-light rounded-2xl p-10 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold font-heading mb-2">Session Complete!</h2>
          {mode === "quiz" && quizScore > 0 && (
            <p className="text-primary font-semibold mb-1">Quiz score: {quizScore} correct</p>
          )}
          <p className="text-muted-foreground mb-6">
            You reviewed {doneCount} card{doneCount !== 1 ? "s" : ""}. Great work!
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => {
                setSessionCards([]);
                setSessionComplete(false);
                setCurrentIndex(0);
                setIsFlipped(false);
                setQuizSelected(null);
                setQuizRevealed(false);
                setQuizScore(0);
                setDoneCount(0);
              }}
              variant="outline"
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Review again
            </Button>
            <Button onClick={() => navigate({ to: "/" })} className="bg-gradient-primary gap-2">
              <ChevronRight className="h-4 w-4" /> Back to dashboard
            </Button>
          </div>
        </div>
      )}

      {/* No cards due */}
      {!sessionComplete && allCards.length === 0 && (
        <div className="card-light rounded-2xl p-10 text-center">
          <Sparkles className="h-12 w-12 text-primary/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">You're all caught up!</h2>
          <p className="text-muted-foreground mb-2">No cards due for review today.</p>
          {totalCards.length === 0 && (
            <p className="text-sm text-muted-foreground mb-6">
              Cards are automatically added when you get questions wrong in quizzes and mock tests.
            </p>
          )}
          <Button onClick={() => setShowAddModal(true)} className="bg-gradient-primary gap-2 mt-4">
            <Plus className="h-4 w-4" /> Add a card manually
          </Button>
        </div>
      )}

      {/* Card area */}
      {!sessionComplete && currentCard && (
        <div className="space-y-6">
          {/* Card counter + source badge */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              {currentCard.subject && (
                <span className="text-primary font-medium">{currentCard.subject}</span>
              )}
              {currentCard.topic ? ` · ${currentCard.topic}` : ""}
              {currentCard.source && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border capitalize" style={{ background: "var(--accent)", borderColor: "var(--border)" }}>
                  {currentCard.source.replace("_", " ")}
                </span>
              )}
            </span>
            <span>{currentIndex + 1} / {allCards.length}</span>
          </div>

          {/* ── QUIZ MODE ── */}
          {effectiveMode === "quiz" && (
            <div className="card-light rounded-2xl p-6 space-y-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Zap className="h-3 w-3 text-primary" /> Quiz Mode
              </div>
              <div className="text-base font-medium leading-relaxed">
                <MarkdownContent content={currentCard.question} />
              </div>
              <div className="space-y-2">
                {currentCard.options!.map((opt, idx) => {
                  const isSelected = quizSelected === idx;
                  const isCorrect = idx === currentCard.correctOptionIndex;
                  let style: React.CSSProperties = { background: "var(--muted)" };
                  let cls = "border text-sm";
                  if (quizRevealed) {
                    if (isCorrect) {
                      style = { background: "rgba(16,185,129,0.1)", borderColor: "rgb(16,185,129)", color: "rgb(16,185,129)" };
                    } else if (isSelected) {
                      style = { background: "rgba(239,68,68,0.1)", borderColor: "#ef4444", color: "#ef4444" };
                    } else {
                      style = { background: "var(--muted)", opacity: 0.5 };
                    }
                  } else if (isSelected) {
                    style = { background: "var(--feat-review-bg)", borderColor: "var(--feat-review)", color: "var(--feat-review)" };
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => handleQuizSelect(idx)}
                      disabled={quizRevealed}
                      style={style}
                      className={cn("w-full text-left px-4 py-3 rounded-xl transition-all flex items-start gap-3", cls)}
                    >
                      {quizRevealed && isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
                      {quizRevealed && isSelected && !isCorrect && <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                      <MarkdownContent content={opt} />
                    </button>
                  );
                })}
              </div>
              {quizRevealed && currentCard.explanation && (
                <div className="p-3 rounded-xl text-xs" style={{ background: "var(--accent)", border: "1px solid var(--border)" }}>
                  <span className="font-semibold uppercase tracking-wide text-[10px] block mb-1">Explanation</span>
                  <MarkdownContent content={currentCard.explanation} className="text-muted-foreground" />
                </div>
              )}
              {/* After reveal, rate the card for spaced repetition */}
              {quizRevealed && (
                <div>
                  <p className="text-center text-xs text-muted-foreground mb-3">How well did you know this?</p>
                  <div className="grid grid-cols-4 gap-2">
                    {RATINGS.map(({ label, value, color, emoji, hint }) => (
                      <button
                        key={label}
                        onClick={() => handleRate(value)}
                        disabled={updateMutation.isPending}
                        className={cn("flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-sm font-medium transition-all", color)}
                      >
                        <span className="text-lg">{emoji}</span>
                        <span>{label}</span>
                        <span className="text-xs opacity-60">{hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── FLASHCARD MODE ── */}
          {effectiveMode === "flashcard" && (
            <>
              <div className="perspective-1000">
                <button
                  onClick={() => setIsFlipped((f) => !f)}
                  className={cn("relative w-full transition-all duration-500 transform-gpu", "cursor-pointer focus:outline-none")}
                  style={{
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    minHeight: "260px",
                  }}
                >
                  {/* Front */}
                  <div
                    className="absolute inset-0 card-light rounded-2xl p-8 flex flex-col items-center justify-center backface-hidden"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    <div className="text-xs text-muted-foreground mb-4 uppercase tracking-wider">Question</div>
                    <div className="text-lg font-medium text-center leading-relaxed">
                      <MarkdownContent content={currentCard.question} />
                    </div>
                    <div className="mt-6 text-xs text-muted-foreground flex items-center gap-1">
                      <RotateCcw className="h-3 w-3" /> tap to reveal answer
                    </div>
                  </div>
                  {/* Back */}
                  <div
                    className="absolute inset-0 rounded-2xl p-8 flex flex-col items-center justify-center border"
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      background: "var(--feat-review-bg)",
                      borderColor: "var(--feat-review)",
                    }}
                  >
                    <div className="text-xs mb-4 uppercase tracking-wider font-medium" style={{ color: "var(--feat-review)" }}>
                      Answer
                    </div>
                    <div className="text-lg font-medium text-center leading-relaxed">
                      <MarkdownContent content={currentCard.answer} />
                    </div>
                    {currentCard.explanation && (
                      <div className="mt-4 text-sm text-muted-foreground text-center">
                        <MarkdownContent content={currentCard.explanation} />
                      </div>
                    )}
                  </div>
                </button>
              </div>

              {/* Rating buttons */}
              <div
                data-tour="tour-review-rate"
                className={cn(
                  "transition-all duration-300",
                  isFlipped ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
                )}
              >
                <p className="text-center text-xs text-muted-foreground mb-3">How well did you know this?</p>
                <div className="grid grid-cols-4 gap-2">
                  {RATINGS.map(({ label, value, color, emoji, hint }) => (
                    <button
                      key={label}
                      onClick={() => handleRate(value)}
                      disabled={updateMutation.isPending}
                      className={cn("flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-sm font-medium transition-all", color)}
                    >
                      <span className="text-lg">{emoji}</span>
                      <span>{label}</span>
                      <span className="text-xs opacity-60">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Skip / delete */}
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                const next = currentIndex + 1;
                setDoneCount((d) => d + 1);
                setQuizSelected(null);
                setQuizRevealed(false);
                setIsFlipped(false);
                if (next >= sessionCards.length) {
                  setSessionComplete(true);
                  setSessionCards([]);
                } else {
                  setCurrentIndex(next);
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={async () => {
                const deletedIndex = currentIndex;
                await deleteMutation.mutateAsync(currentCard.id);
                toast.success("Card deleted");
                const newCards = sessionCards.filter((_: unknown, i: number) => i !== deletedIndex);
                setSessionCards(newCards);
                setQuizSelected(null);
                setQuizRevealed(false);
                setIsFlipped(false);
                if (newCards.length === 0 || deletedIndex >= newCards.length) {
                  if (newCards.length === 0) {
                    setSessionComplete(true);
                    setSessionCards([]);
                  } else {
                    setCurrentIndex(newCards.length - 1);
                  }
                }
              }}
              className="text-xs text-muted-foreground hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Delete card
            </button>
          </div>
        </div>
      )}

      {/* Add Card Modal */}
      {showAddModal && (
        <AddCardModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["reviewCards"] });
            qc.invalidateQueries({ queryKey: ["allReviewCards"] });
          }}
        />
      )}

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .backface-hidden { backface-visibility: hidden; }
      `}</style>
    </div>
  );
}

/* ─── Add Card Modal ─── */
function AddCardModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!question.trim() || !answer.trim()) return toast.error("Question and answer are required");
    setSaving(true);
    try {
      await api.saveReviewCard({
        question: question.trim(),
        answer: answer.trim(),
        explanation: explanation.trim() || undefined,
        subject: subject.trim() || undefined,
        source: "manual",
        ease_factor: 2.5,
        interval_days: 1,
        repetitions: 0,
        next_review: todayIST(),
      });
      toast.success("Card added!");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card-light rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Add Review Card</h2>
          <button onClick={onClose}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Subject (optional)</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Physics"
              className="w-full mt-1 rounded-lg border border-border px-3 py-2 text-sm outline-none"
              style={{ background: "var(--muted)" }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Question *</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What is the formula for kinetic energy?"
              rows={3}
              className="w-full mt-1 rounded-lg border border-border px-3 py-2 text-sm outline-none resize-none"
              style={{ background: "var(--muted)" }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Answer *</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="KE = ½mv²"
              rows={2}
              className="w-full mt-1 rounded-lg border border-border px-3 py-2 text-sm outline-none resize-none"
              style={{ background: "var(--muted)" }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Explanation (optional)</label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Where m = mass in kg, v = velocity in m/s"
              rows={2}
              className="w-full mt-1 rounded-lg border border-border px-3 py-2 text-sm outline-none resize-none"
              style={{ background: "var(--muted)" }}
            />
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-gradient-primary">
            {saving ? "Saving…" : "Save Card"}
          </Button>
        </div>
      </div>
    </div>
  );
}
