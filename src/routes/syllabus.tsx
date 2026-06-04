import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2, Loader2 } from "lucide-react";
import { uid, type Subject } from "@/lib/storage";
import { parseSyllabus } from "@/lib/ai.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/syllabus")({
  head: () => ({
    meta: [
      { title: "Syllabus — AcePrep" },
      { name: "description", content: "Track your syllabus topic by topic with AI-assisted parsing." },
    ],
  }),
  component: SyllabusPage,
});

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#06b6d4"];

function SyllabusPage() {
  const queryClient = useQueryClient();
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: api.getSubjects });
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [newSubject, setNewSubject] = useState("");

  const saveMutation = useMutation({
    mutationFn: api.saveSubject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subjects"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteSubject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subjects"] }),
  });

  const addSubject = (name: string, topics: string[] = []) => {
    if (!name.trim()) return;
    const subject: Subject = {
      id: uid(),
      name: name.trim(),
      color: COLORS[subjects.length % COLORS.length],
      topics: topics.map((t) => ({ id: uid(), name: t, done: false })),
    };
    saveMutation.mutate(subject);
  };

  const handleParse = async () => {
    if (!raw.trim()) return;
    setLoading(true);
    try {
      const res = await parseSyllabus({ data: { text: raw } });
      const next: Subject[] = res.subjects.map((s, i) => ({
        id: uid(),
        name: s.name,
        color: COLORS[(subjects.length + i) % COLORS.length],
        topics: s.topics.map((t) => ({ id: uid(), name: t, done: false })),
      }));
      await Promise.all(next.map(s => saveMutation.mutateAsync(s)));
      setRaw("");
      toast.success(`Added ${next.length} subjects`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to parse syllabus");
    } finally {
      setLoading(false);
    }
  };

  const toggleTopic = (sid: string, tid: string) => {
    const s = subjects.find(x => x.id === sid);
    if (!s) return;
    const updated = { ...s, topics: s.topics.map((t) => (t.id === tid ? { ...t, done: !t.done } : t)) };
    saveMutation.mutate(updated);
  };

  const addTopic = (sid: string, name: string) => {
    if (!name.trim()) return;
    const s = subjects.find(x => x.id === sid);
    if (!s) return;
    const updated = { ...s, topics: [...s.topics, { id: uid(), name: name.trim(), done: false }] };
    saveMutation.mutate(updated);
  };

  const removeSubject = (sid: string) => deleteMutation.mutate(sid);
  const removeTopic = (sid: string, tid: string) => {
    const s = subjects.find(x => x.id === sid);
    if (!s) return;
    const updated = { ...s, topics: s.topics.filter((t) => t.id !== tid) };
    saveMutation.mutate(updated);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight font-heading">Syllabus tracker</h1>
      <p className="text-muted-foreground mt-1">Paste your syllabus and let AI organize it, or add subjects manually.</p>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="p-5 rounded-2xl glass-card">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <Sparkles className="h-4 w-4 text-primary" /> AI parse syllabus
          </div>
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste raw syllabus text here…"
            className="min-h-32"
          />
          <Button onClick={handleParse} disabled={loading || !raw.trim()} className="mt-3 w-full bg-gradient-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Parse with AI"}
          </Button>
        </div>
        <div className="p-5 rounded-2xl glass-card">
          <div className="text-sm font-medium mb-3">Add subject manually</div>
          <div className="flex gap-2">
            <Input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="e.g. Calculus II"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addSubject(newSubject);
                  setNewSubject("");
                }
              }}
            />
            <Button
              variant="secondary"
              onClick={() => {
                addSubject(newSubject);
                setNewSubject("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Then click into the subject below to add topics one by one.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {subjects.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
            No subjects yet. Paste a syllabus or add one above.
          </div>
        ) : (
          subjects.map((s) => {
            const done = s.topics.filter((t) => t.done).length;
            const pct = s.topics.length ? Math.round((done / s.topics.length) * 100) : 0;
            return <SubjectCard key={s.id} subject={s} pct={pct} done={done} onToggle={toggleTopic} onAddTopic={addTopic} onRemove={removeSubject} onRemoveTopic={removeTopic} />;
          })
        )}
      </div>
    </div>
  );
}

function SubjectCard({
  subject,
  pct,
  done,
  onToggle,
  onAddTopic,
  onRemove,
  onRemoveTopic,
}: {
  subject: Subject;
  pct: number;
  done: number;
  onToggle: (sid: string, tid: string) => void;
  onAddTopic: (sid: string, name: string) => void;
  onRemove: (sid: string) => void;
  onRemoveTopic: (sid: string, tid: string) => void;
}) {
  const [topic, setTopic] = useState("");
  return (
    <div className="p-5 rounded-2xl glass-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-3 w-3 rounded-full" style={{ background: subject.color }} />
          <div className="font-semibold truncate">{subject.name}</div>
          <span className="text-xs text-muted-foreground">{done}/{subject.topics.length} · {pct}%</span>
        </div>
        <Button size="icon" variant="ghost" onClick={() => onRemove(subject.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 space-y-1.5">
        {subject.topics.map((t) => (
          <label
            key={t.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer group"
          >
            <Checkbox checked={t.done} onCheckedChange={() => onToggle(subject.id, t.id)} />
            <span className={t.done ? "line-through text-muted-foreground flex-1" : "flex-1"}>{t.name}</span>
            <button
              onClick={(e) => {
                e.preventDefault();
                onRemoveTopic(subject.id, t.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </label>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Add a topic…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onAddTopic(subject.id, topic);
              setTopic("");
            }
          }}
        />
        <Button
          variant="secondary"
          onClick={() => {
            onAddTopic(subject.id, topic);
            setTopic("");
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
