import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2, RotateCw, BookOpen } from "lucide-react";
import { uid, type Note } from "@/lib/storage";
import { generateNotes } from "@/lib/ai.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const { data: notes = [] } = useQuery({ queryKey: ["notes"], queryFn: api.getNotes });
  const { data: profile } = useQuery({ queryKey: ["userProfile"], queryFn: api.getUserProfile });

  const saveMutation = useMutation({
    mutationFn: api.saveNote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteNote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const res = await generateNotes({ data: { topic, examName: profile?.exam_name } });
      const note: Note = {
        id: uid(),
        topic: topic.trim(),
        summary: res.summary,
        flashcards: res.flashcards,
        createdAt: Date.now(),
      };
      await saveMutation.mutateAsync(note);
      setTopic("");
      toast.success("Notes generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate notes");
    } finally {
      setLoading(false);
    }
  };

  const remove = (id: string) => deleteMutation.mutate(id);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight font-heading">Notes & flashcards</h1>
      <p className="text-muted-foreground mt-1">
        Drop a syllabus topic, get a crisp summary and flashcard deck.
        {profile?.exam_name && <span className="text-primary font-medium"> Tailored for {profile.exam_name}.</span>}
      </p>

      <div className="p-5 rounded-2xl glass-card mt-6">
        <div className="flex items-center gap-2 text-sm font-medium mb-3">
          <Sparkles className="h-4 w-4 text-primary" /> Generate
        </div>
        <div className="flex gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={profile?.exam_name ? `e.g. Kinematics, Organic Chemistry, Integral Calculus...` : "e.g. Kinematics, Organic Chemistry..."}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
          />
          <Button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="bg-gradient-primary"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {notes.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
            No notes yet.
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
  const total = note.flashcards.length;
  const card = note.flashcards[idx];
  const next = () => {
    setRevealed(false);
    setIdx((i) => (i + 1) % total);
  };

  return (
    <div className="p-5 rounded-2xl glass-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{note.topic}</div>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{note.summary}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-5">
        <div className="text-xs text-muted-foreground mb-2">
          Flashcard {idx + 1} / {total}
        </div>
        <button
          onClick={() => setRevealed((r) => !r)}
          className="w-full text-left p-5 rounded-2xl glass-subtle hover:border-primary/30 transition-all min-h-32"
        >
          <div className="text-xs uppercase tracking-wide text-primary mb-2">
            {revealed ? "Answer" : "Question"}
          </div>
          <div className="text-base">{revealed ? card.a : card.q}</div>
          {!revealed && <div className="text-xs text-muted-foreground mt-3">Tap to reveal</div>}
        </button>
        <div className="flex justify-end mt-3">
          <Button variant="secondary" size="sm" onClick={next}>
            <RotateCw className="h-3.5 w-3.5 mr-1" /> Next
          </Button>
        </div>
      </div>
    </div>
  );
}
