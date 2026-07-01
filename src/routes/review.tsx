import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type ReviewCard } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Brain,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  ChevronRight,
  Star,
  Flame,
  CalendarCheck,
  Sparkles,
  BookOpen,
  X,
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
  { label: "Again", value: 0 as const, color: "bg-red-500/15 text-red-400 border-red-500/20 hover:bg-red-500/25", emoji: "🔴", hint: "< 1 day" },
  { label: "Hard",  value: 1 as const, color: "bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/25", emoji: "🟡", hint: "1 day" },
  { label: "Good",  value: 3 as const, color: "bg-blue-500/15 text-blue-400 border-blue-500/20 hover:bg-blue-500/25", emoji: "🔵", hint: "few days" },
  { label: "Easy",  value: 5 as const, color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25", emoji: "🟢", hint: "long" },
];

function ReviewPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviewCards"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteReviewCard,
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

  // Reset when cards load
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setDoneCount(0);
    setSessionComplete(false);
  }, [allCards.length]);

  const currentCard = allCards[currentIndex];
  const progress = allCards.length > 0 ? (doneCount / allCards.length) * 100 : 0;

  const handleRate = async (rating: 0 | 1 | 3 | 5) => {
    if (!currentCard) return;
    await updateMutation.mutateAsync({ id: currentCard.id, rating });
    const next = currentIndex + 1;
    setDoneCount((d) => d + 1);
    if (next >= allCards.length) {
      setSessionComplete(true);
    } else {
      setCurrentIndex(next);
      setIsFlipped(false);
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
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto">
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
            className="flex items-center gap-2 px-3 py-2 rounded-xl glass-subtle text-sm hover:border-primary/30 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add card
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          {[
            { label: "Due today", value: allCards.length, icon: CalendarCheck, color: "text-primary" },
            { label: "Total cards", value: totalCards.length, icon: BookOpen, color: "text-accent" },
            { label: "Done today", value: doneCount, icon: CheckCircle2, color: "text-emerald-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass-card rounded-xl p-4 text-center">
              <Icon className={cn("h-5 w-5 mx-auto mb-1", color)} />
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {allCards.length > 0 && (
          <div className="mt-4 h-1.5 bg-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Session complete */}
      {sessionComplete && (
        <div className="glass-card rounded-2xl p-10 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold font-heading mb-2">Session Complete!</h2>
          <p className="text-muted-foreground mb-6">
            You reviewed {doneCount} card{doneCount !== 1 ? "s" : ""}. Great work!
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => { setSessionComplete(false); setCurrentIndex(0); setIsFlipped(false); setDoneCount(0); }}
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
        <div className="glass-card rounded-2xl p-10 text-center">
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
            <span>{currentCard.subject && <span className="text-primary font-medium">{currentCard.subject}</span>}{currentCard.topic ? ` · ${currentCard.topic}` : ""}</span>
            <span>{currentIndex + 1} / {allCards.length}</span>
          </div>

          {/* Flip card */}
          <div className="perspective-1000">
            <button
              onClick={() => setIsFlipped((f) => !f)}
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
                className="absolute inset-0 glass-card rounded-2xl p-8 flex flex-col items-center justify-center backface-hidden"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="text-xs text-muted-foreground mb-4 uppercase tracking-wider">Question</div>
                <p className="text-lg font-medium text-center leading-relaxed">{currentCard.question}</p>
                <div className="mt-6 text-xs text-muted-foreground flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" /> tap to reveal answer
                </div>
              </div>
              {/* Back */}
              <div
                className="absolute inset-0 glass-card rounded-2xl p-8 flex flex-col items-center justify-center border border-primary/20"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <div className="text-xs text-primary mb-4 uppercase tracking-wider font-medium">Answer</div>
                <p className="text-lg font-medium text-center leading-relaxed">{currentCard.answer}</p>
                {currentCard.explanation && (
                  <p className="mt-4 text-sm text-muted-foreground text-center">{currentCard.explanation}</p>
                )}
              </div>
            </button>
          </div>

          {/* Rating buttons — only shown after flip */}
          <div className={cn("transition-all duration-300", isFlipped ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none")}>
            <p className="text-center text-xs text-muted-foreground mb-3">How well did you know this?</p>
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
              onClick={() => { setCurrentIndex((i) => Math.min(i + 1, allCards.length - 1)); setIsFlipped(false); }}
              className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={async () => {
                await deleteMutation.mutateAsync(currentCard.id);
                toast.success("Card deleted");
              }}
              className="text-xs text-muted-foreground hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Delete card
            </button>
          </div>
        </div>
      )}

      {/* Add Card Modal */}
      {showAddModal && <AddCardModal onClose={() => setShowAddModal(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["reviewCards"] }); qc.invalidateQueries({ queryKey: ["allReviewCards"] }); }} />}

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
        next_review: new Date().toISOString().split("T")[0],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Add Review Card</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Subject (optional)</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Physics" className="w-full mt-1 glass-subtle rounded-lg px-3 py-2 text-sm bg-transparent outline-none" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Question *</label>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What is the formula for kinetic energy?" rows={3} className="w-full mt-1 glass-subtle rounded-lg px-3 py-2 text-sm bg-transparent outline-none resize-none" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Answer *</label>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="KE = ½mv²" rows={2} className="w-full mt-1 glass-subtle rounded-lg px-3 py-2 text-sm bg-transparent outline-none resize-none" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Explanation (optional)</label>
            <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Where m = mass in kg, v = velocity in m/s" rows={2} className="w-full mt-1 glass-subtle rounded-lg px-3 py-2 text-sm bg-transparent outline-none resize-none" />
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-gradient-primary">
            {saving ? "Saving…" : "Save Card"}
          </Button>
        </div>
      </div>
    </div>
  );
}
