import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { todayIST } from "@/lib/date-utils";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type ReviewCard, XP_REWARDS } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTutorial } from "@/components/TutorialProvider";
import {
  Brain,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  ChevronRight,
  CalendarCheck,
  Sparkles,
  BookOpen,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/MarkdownContent";

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
      // Bug fix: invalidate both query keys so "Total cards" stat stays in sync
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
  // Snapshot the full card objects at session start so query re-fetches
  // (triggered by invalidateQueries after rating) don't reorder or remove cards mid-session.
  const [sessionCards, setSessionCards] = useState<ReviewCard[]>([]);

  // Reset only when a genuinely new set of cards loads (first load or after
  // session completes / user explicitly restarts).
  useEffect(() => {
    if (allCards.length === 0) return; // nothing to do
    if (sessionCards.length > 0) return; // session already running
    setSessionCards([...allCards]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setDoneCount(0);
    setSessionComplete(false);
  }, [allCards]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentCard = sessionCards[currentIndex];
  const sessionTotal = sessionCards.length || allCards.length;
  const progress = sessionTotal > 0 ? (doneCount / sessionTotal) * 100 : 0;

  const handleRate = async (rating: 0 | 1 | 3 | 5) => {
    if (!currentCard) return;
    try {
      await updateMutation.mutateAsync({ id: currentCard.id, rating });
      // Award XP for reviewing a card (fire-and-forget)
      api.awardXP(XP_REWARDS.review_card, { reviewCount: doneCount + 1 }).catch(() => {});
      const next = currentIndex + 1;
      setDoneCount((d) => d + 1);
      if (next >= sessionCards.length) {
        setSessionComplete(true);
        setSessionCards([]); // clear so next load starts fresh
      } else {
        setCurrentIndex(next);
        setIsFlipped(false);
      }
    } catch {
      toast.error("Failed to save rating. Please try again.");
    }
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
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:border-primary/30 transition-colors"
            style={{ background: "var(--muted)" }}
          >
            <Plus className="h-4 w-4" /> Add card
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-6" data-tour="tour-review-cards">
          {[
            {
              label: "Due today",
              value: allCards.length,
              icon: CalendarCheck,
              color: "text-primary",
            },
            {
              label: "Total cards",
              value: totalCards.length,
              icon: BookOpen,
              color: "text-primary",
            },
            {
              label: "Done today",
              value: doneCount,
              icon: CheckCircle2,
              color: "text-emerald-600",
            },
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
          <div
            className="mt-4 h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--muted)" }}
          >
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
          <p className="text-muted-foreground mb-6">
            You reviewed {doneCount} card{doneCount !== 1 ? "s" : ""}. Great work!
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => {
                // Clear session IDs so the useEffect can reinitialize with current cards
                setSessionCards([]);
                setSessionComplete(false);
                setCurrentIndex(0);
                setIsFlipped(false);
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

      {/* Flip Card */}
      {!sessionComplete && currentCard && (
        <div className="space-y-6">
          {/* Card counter */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {currentCard.subject && (
                <span className="text-primary font-medium">{currentCard.subject}</span>
              )}
              {currentCard.topic ? ` · ${currentCard.topic}` : ""}
            </span>
            <span>
              {currentIndex + 1} / {allCards.length}
            </span>
          </div>

          {/* Flip card */}
          <div className="perspective-1000">
            {/* div[role=button] instead of <button> so MarkdownContent's block math elements are valid HTML */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsFlipped((f) => !f)}
              onKeyDown={(e) =>
                (e.key === "Enter" || e.key === " ") && setIsFlipped((f) => !f)
              }
              className={cn(
                "relative w-full transition-all duration-500 transform-gpu",
                "cursor-pointer focus:outline-none",
              )}
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
                <div className="text-xs text-muted-foreground mb-4 uppercase tracking-wider">
                  Question
                </div>
                <div className="text-lg font-medium text-center leading-relaxed w-full">
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
                <div
                  className="text-xs mb-4 uppercase tracking-wider font-medium"
                  style={{ color: "var(--feat-review)" }}
                >
                  Answer
                </div>
                <div className="text-lg font-medium text-center leading-relaxed w-full">
                  <MarkdownContent content={currentCard.answer} />
                </div>
                {currentCard.explanation && (
                  <div className="mt-4 text-sm text-muted-foreground text-center w-full">
                    <MarkdownContent content={currentCard.explanation} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rating buttons — only shown after flip */}
          <div
            data-tour="tour-review-rate"
            className={cn(
              "transition-all duration-300",
              isFlipped
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4 pointer-events-none",
            )}
          >
            <p className="text-center text-xs text-muted-foreground mb-3">
              How well did you know this?
            </p>
            <div className="grid grid-cols-4 gap-2">
              {RATINGS.map(({ label, value, color, emoji, hint }) => (
                <button
                  key={label}
                  onClick={() => handleRate(value)}
                  disabled={updateMutation.isPending}
                  className={cn(
                    "flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-sm font-medium transition-all",
                    color,
                  )}
                >
                  <span className="text-lg">{emoji}</span>
                  <span>{label}</span>
                  <span className="text-xs opacity-60">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Skip / delete */}
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                // Bug fix: also increment doneCount on skip so progress bar is accurate
                const next = currentIndex + 1;
                setDoneCount((d) => d + 1);
                if (next >= sessionCards.length) {
                  setSessionComplete(true);
                  setSessionCards([]);
                } else {
                  setCurrentIndex(next);
                  setIsFlipped(false);
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={async () => {
                // Bug fix: adjust index after deletion so we don't land on undefined
                const deletedIndex = currentIndex;
                await deleteMutation.mutateAsync(currentCard.id);
                toast.success("Card deleted");
                // Remove from session list
                const newCards = sessionCards.filter((_: unknown, i: number) => i !== deletedIndex);
                setSessionCards(newCards);
                if (newCards.length === 0 || deletedIndex >= newCards.length) {
                  // Deleted the last card in session
                  if (newCards.length === 0) {
                    setSessionComplete(true);
                    setSessionCards([]);
                  } else {
                    // Stay at same index (now pointing to next card)
                    setCurrentIndex(newCards.length - 1);
                    setIsFlipped(false);
                  }
                } else {
                  setIsFlipped(false);
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
