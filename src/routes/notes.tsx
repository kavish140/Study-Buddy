import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2, RotateCw, BookOpen, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { uid, type Note } from "@/lib/storage";
import { generateNotes } from "@/lib/ai.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTutorial } from "@/components/TutorialProvider";
import { MarkdownContent } from "@/components/MarkdownContent";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Notes & Flashcards — AcePrep" },
      {
        name: "description",
        content: "Turn any topic into a clear summary and flashcard deck with AI.",
      },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const queryClient = useQueryClient();
  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["notes"],
    queryFn: api.getNotes,
  });
  const { data: profile } = useQuery({ queryKey: ["userProfile"], queryFn: api.getUserProfile });
  const { triggerPageTour } = useTutorial();

  useEffect(() => {
    triggerPageTour("notes");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: api.saveNote,
    onError: (error) => toast.error(error.message || "Failed to save note"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteNote,
    onError: (error) => toast.error(error.message || "Failed to delete note"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });

  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleGenerate = async (topicOverride?: string) => {
    const t = (topicOverride ?? topic).trim();
    if (!t) return;
    setLoading(true);
    try {
      const res = await generateNotes({
        data: { topic: t, examName: profile?.exam_name, source: "notes" },
      });

      // Defensive: handle all possible AI response shapes
      const summary =
        typeof res.summary === "string" && res.summary.trim()
          ? res.summary
          : "Summary not available. Please try regenerating.";

      const flashcards = Array.isArray(res.flashcards)
        ? res.flashcards.filter(
            (fc) => fc && typeof fc.q === "string" && typeof fc.a === "string",
          )
        : [];

      const note: Note = {
        id: uid(),
        topic: t,
        summary,
        flashcards,
        createdAt: Date.now(),
      };

      // Use mutate (not mutateAsync) so the mutation's onError handler is the
      // single place that shows the error toast — prevents duplicate toasts.
      saveMutation.mutate(note, {
        onSuccess: () => {
          setTopic("");
          setRetryCount(0);
          toast.success(`✅ Notes & ${flashcards.length} flashcards generated!`);
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate notes";
      // Suggest retry on edge function / timeout errors
      toast.error(msg, {
        action:
          retryCount < 2
            ? {
                label: "Retry",
                onClick: () => {
                  setRetryCount((c) => c + 1);
                  handleGenerate(t);
                },
              }
            : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const remove = (id: string) => deleteMutation.mutate(id);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 animate-fade-up">
      <h1 className="text-3xl font-bold tracking-tight font-heading">Notes & flashcards</h1>
      <p className="text-muted-foreground mt-1">
        Drop a syllabus topic, get a crisp summary and flashcard deck.
        {profile?.exam_name && (
          <span className="text-primary font-medium"> Tailored for {profile.exam_name}.</span>
        )}
      </p>

      {/* Generate panel */}
      <div className="p-5 rounded-2xl card-light mt-6" data-tour="tour-notes-topic">
        <div className="flex items-center gap-2 text-sm font-medium mb-3">
          <Sparkles className="h-4 w-4 text-primary" /> Generate
        </div>
        <div className="flex gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={
              profile?.exam_name
                ? `e.g. Kinematics, Organic Chemistry, Integral Calculus...`
                : "e.g. Kinematics, Organic Chemistry..."
            }
            onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
          />
          <Button
            onClick={() => handleGenerate()}
            disabled={loading || !topic.trim()}
            className="bg-gradient-primary shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
          </Button>
        </div>
        {loading && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating notes and flashcards — this may take a few seconds…
          </p>
        )}
      </div>

      {/* Notes list */}
      <div className="mt-8 space-y-4">
        {notesLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 card-light rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
            <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p>No notes yet. Enter a topic above to get started!</p>
          </div>
        ) : (
          notes.map((n) => <NoteCard key={n.id} note={n} onRemove={() => remove(n.id)} />)
        )}
      </div>
    </div>
  );
}

function NoteCard({ note, onRemove }: { note: Note; onRemove: () => void }) {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const total = note.flashcards.length;
  const card = total > 0 ? note.flashcards[idx] : null;

  // Move to next card, always starting in question (unrevealed) state
  const next = () => {
    if (total === 0) return;
    setRevealed(false);
    setIdx((i) => (i + 1) % total);
  };

  // Move to previous card, always starting in question (unrevealed) state
  const prev = () => {
    if (total === 0) return;
    setRevealed(false);
    setIdx((i) => (i - 1 + total) % total);
  };

  // Summary text: collapse long summaries
  const SUMMARY_LIMIT = 400;
  const summaryText = note.summary ?? "";
  const isLong = summaryText.length > SUMMARY_LIMIT;
  const displayedSummary =
    isLong && !summaryExpanded ? summaryText.slice(0, SUMMARY_LIMIT) + "…" : summaryText;

  return (
    <div
      className="p-5 rounded-2xl card-light"
      style={{ borderLeft: "3px solid var(--feat-notes)" }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-base">{note.topic}</div>

          {/* Summary — rendered through MarkdownContent for LaTeX support */}
          <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
            <MarkdownContent content={displayedSummary} />
            {isLong && (
              <button
                onClick={() => setSummaryExpanded((e) => !e)}
                className="mt-1 text-xs text-primary hover:underline"
              >
                {summaryExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onRemove} className="shrink-0">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Flashcard section */}
      <div className="mt-5" data-tour="tour-notes-flashcard">
        {total === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">
            <BookOpen className="h-5 w-5 mx-auto mb-2 opacity-50" />
            No flashcards available for this note.
          </div>
        ) : (
          <>
            {/* Card counter */}
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>
                Flashcard {idx + 1} / {total}
              </span>
              <span
                className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--feat-notes-bg)",
                  color: "var(--feat-notes)",
                }}
              >
                {revealed ? "Answer" : "Question"}
              </span>
            </div>

            {/* Flip card — using div+role="button" so MarkdownContent block elements are valid */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setRevealed((r) => !r)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setRevealed((r) => !r)}
              className={cn(
                "w-full text-left p-5 rounded-2xl border cursor-pointer transition-all duration-200 min-h-32",
                "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              )}
              style={{
                background: "var(--feat-notes-bg)",
                borderColor: "var(--feat-notes)",
                borderWidth: "1px",
              }}
            >
              {/* Q or A — rendered through MarkdownContent for LaTeX support */}
              <div className="text-sm leading-relaxed">
                <MarkdownContent content={revealed ? card!.a : card!.q} />
              </div>

              {/* "Tap to reveal" hint only on question side */}
              {!revealed && (
                <div className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Tap to reveal answer
                </div>
              )}
            </div>

            {/* Navigation controls */}
            <div className="flex items-center justify-between mt-3">
              <Button variant="secondary" size="sm" onClick={prev} disabled={total <= 1}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                {idx + 1} / {total}
              </span>
              <Button variant="secondary" size="sm" onClick={next}>
                Next <RotateCw className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
