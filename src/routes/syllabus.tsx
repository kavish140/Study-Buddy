import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2, Loader2, BookOpen, GraduationCap } from "lucide-react";
import { uid, type Subject } from "@/lib/storage";
import { parseSyllabus } from "@/lib/ai.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useTutorial } from "@/components/TutorialProvider";

export const Route = createFileRoute("/syllabus")({
  head: () => ({
    meta: [
      { title: "Syllabus — AcePrep" },
      {
        name: "description",
        content: "Track your syllabus topic by topic with AI-assisted parsing.",
      },
    ],
  }),
  component: SyllabusPage,
});

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#06b6d4"];

function SyllabusPage() {
  const queryClient = useQueryClient();
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: api.getSubjects });
  const { data: profile } = useQuery({ queryKey: ["userProfile"], queryFn: api.getUserProfile });
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [classFilter, setClassFilter] = useState<"11" | "12" | null>(null);
  const { triggerPageTour } = useTutorial();

  useEffect(() => {
    triggerPageTour("syllabus");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // JEE/NEET class-wise topic split
  const isJeeNeet =
    profile?.exam_id && ["jee-main", "jee-advanced", "neet"].includes(profile.exam_id);

  const CLASS_TOPICS: Record<
    string,
    Record<"11" | "12", { subject: string; topics: string[] }[]>
  > = {
    "jee-main": {
      "11": [
        {
          subject: "Physics",
          topics: [
            "Units and Measurements",
            "Kinematics",
            "Laws of Motion",
            "Work, Energy and Power",
            "Rotational Motion",
            "Gravitation",
            "Properties of Solids and Liquids",
            "Thermodynamics",
            "Kinetic Theory of Gases",
            "Oscillations and Waves",
          ],
        },
        {
          subject: "Chemistry",
          topics: [
            "Some Basic Concepts in Chemistry",
            "Atomic Structure",
            "Chemical Bonding",
            "States of Matter",
            "Chemical Thermodynamics",
            "Equilibrium",
            "Redox Reactions",
            "Hydrogen",
            "s-Block Elements",
            "p-Block Elements (Part 1)",
            "Organic Chemistry Basics",
            "Hydrocarbons",
            "Environmental Chemistry",
          ],
        },
        {
          subject: "Mathematics",
          topics: [
            "Sets, Relations and Functions",
            "Complex Numbers",
            "Quadratic Equations",
            "Permutations and Combinations",
            "Binomial Theorem",
            "Sequences and Series",
            "Limits and Derivatives",
            "Trigonometry",
            "Straight Lines",
            "Conic Sections",
            "Statistics and Probability",
            "Mathematical Reasoning",
          ],
        },
      ],
      "12": [
        {
          subject: "Physics",
          topics: [
            "Electrostatics",
            "Current Electricity",
            "Magnetic Effects of Current",
            "Electromagnetic Induction",
            "Electromagnetic Waves",
            "Optics",
            "Dual Nature of Matter and Radiation",
            "Atoms and Nuclei",
            "Electronic Devices",
            "Communication Systems",
          ],
        },
        {
          subject: "Chemistry",
          topics: [
            "Solid State",
            "Solutions",
            "Electrochemistry",
            "Chemical Kinetics",
            "Surface Chemistry",
            "Classification of Elements",
            "d and f Block Elements",
            "Coordination Compounds",
            "Organic Compounds with Functional Groups",
            "Polymers",
            "Biomolecules",
            "Chemistry in Everyday Life",
          ],
        },
        {
          subject: "Mathematics",
          topics: [
            "Matrices and Determinants",
            "Integral Calculus",
            "Differential Equations",
            "Coordinate Geometry",
            "Three Dimensional Geometry",
            "Vector Algebra",
            "Statistics and Probability (Advanced)",
          ],
        },
      ],
    },
    neet: {
      "11": [
        {
          subject: "Physics",
          topics: [
            "Physical World and Measurement",
            "Kinematics",
            "Laws of Motion",
            "Work, Energy and Power",
            "Motion of System of Particles",
            "Gravitation",
            "Properties of Bulk Matter",
            "Thermodynamics",
            "Kinetic Theory of Gases",
            "Oscillations and Waves",
          ],
        },
        {
          subject: "Chemistry",
          topics: [
            "Basic Concepts of Chemistry",
            "Structure of Atom",
            "Classification of Elements",
            "Chemical Bonding",
            "States of Matter",
            "Thermodynamics",
            "Equilibrium",
            "Redox Reactions",
            "Hydrogen",
            "s-Block Elements",
            "p-Block Elements",
            "Organic Chemistry Basics",
            "Hydrocarbons",
            "Environmental Chemistry",
          ],
        },
        {
          subject: "Biology",
          topics: [
            "Diversity in Living World",
            "Structural Organisation in Animals and Plants",
            "Cell Structure and Function",
            "Plant Physiology",
            "Human Physiology",
          ],
        },
      ],
      "12": [
        {
          subject: "Physics",
          topics: [
            "Electrostatics",
            "Current Electricity",
            "Magnetic Effects of Current",
            "Electromagnetic Induction and AC",
            "Electromagnetic Waves",
            "Optics",
            "Dual Nature of Radiation",
            "Atoms and Nuclei",
            "Electronic Devices",
          ],
        },
        {
          subject: "Chemistry",
          topics: [
            "Solid State",
            "Solutions",
            "Electrochemistry",
            "Chemical Kinetics",
            "Surface Chemistry",
            "d and f Block Elements",
            "Coordination Compounds",
            "Aldehydes, Ketones",
            "Amines",
            "Biomolecules",
            "Polymers",
          ],
        },
        {
          subject: "Biology",
          topics: [
            "Reproduction",
            "Genetics and Evolution",
            "Biology and Human Welfare",
            "Biotechnology",
            "Ecology and Environment",
          ],
        },
      ],
    },
  };

  // jee-advanced shares the same broad topic list as jee-main
  const resolvedExamId =
    profile?.exam_id === "jee-advanced" ? "jee-main" : (profile?.exam_id ?? "");
  const classTopics =
    isJeeNeet && classFilter && CLASS_TOPICS[resolvedExamId]
      ? CLASS_TOPICS[resolvedExamId][classFilter]
      : null;

  const saveMutation = useMutation({
    mutationFn: api.saveSubject,
    onError: (error) => toast.error(error.message || "Operation failed"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subjects"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteSubject,
    onError: (error) => toast.error(error.message || "Operation failed"),
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
      const res = await parseSyllabus({ data: { text: raw, source: "syllabus" } });
      const next: Subject[] = res.subjects.map((s, i) => ({
        id: uid(),
        name: s.name,
        color: COLORS[(subjects.length + i) % COLORS.length],
        topics: s.topics.map((t) => ({ id: uid(), name: t, done: false })),
      }));
      await Promise.all(next.map((s) => saveMutation.mutateAsync(s)));
      setRaw("");
      toast.success(`Added ${next.length} subjects`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to parse syllabus");
    } finally {
      setLoading(false);
    }
  };

  const toggleTopic = (sid: string, tid: string) => {
    const s = subjects.find((x) => x.id === sid);
    if (!s) return;
    const updated = {
      ...s,
      topics: s.topics.map((t) => (t.id === tid ? { ...t, done: !t.done } : t)),
    };
    saveMutation.mutate(updated);
  };

  const addTopic = (sid: string, name: string) => {
    if (!name.trim()) return;
    const s = subjects.find((x) => x.id === sid);
    if (!s) return;
    const updated = { ...s, topics: [...s.topics, { id: uid(), name: name.trim(), done: false }] };
    saveMutation.mutate(updated);
  };

  const removeSubject = (sid: string) => deleteMutation.mutate(sid);
  const removeTopic = (sid: string, tid: string) => {
    const s = subjects.find((x) => x.id === sid);
    if (!s) return;
    const updated = { ...s, topics: s.topics.filter((t) => t.id !== tid) };
    saveMutation.mutate(updated);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight font-heading">Syllabus tracker</h1>
      <p className="text-muted-foreground mt-1">
        Track your topics chapter by chapter. Mark done as you go.
      </p>

      {/* Class 11 / 12 quick-loader for JEE/NEET */}
      {isJeeNeet && (
        <div className="glass-card p-5 rounded-2xl mt-6">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <GraduationCap className="h-4 w-4 text-primary" />
            Quick load syllabus by class
            <span className="text-xs text-muted-foreground ml-1">({profile?.exam_name})</span>
          </div>
          <div className="flex gap-3 mb-4">
            {(["11", "12"] as const).map((cls) => (
              <button
                key={cls}
                onClick={() => setClassFilter(classFilter === cls ? null : cls)}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                  classFilter === cls
                    ? "bg-gradient-primary text-white shadow-glow-sm"
                    : "glass-subtle text-muted-foreground hover:text-foreground",
                )}
              >
                Class {cls}
              </button>
            ))}
          </div>

          {classTopics && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                These are the Class {classFilter} topics for {profile?.exam_name}. Click a subject
                to load it into your tracker.
              </p>
              <div className="grid sm:grid-cols-3 gap-2">
                {classTopics.map((group) => (
                  <div key={group.subject} className="glass-subtle p-3 rounded-xl">
                    <div className="text-xs font-semibold text-primary mb-2">
                      {group.subject} · {group.topics.length} topics
                    </div>
                    <div className="space-y-0.5 max-h-40 overflow-y-auto">
                      {group.topics.map((t) => (
                        <div key={t} className="text-xs text-muted-foreground py-0.5">
                          {t}
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2 w-full text-xs"
                      onClick={() =>
                        addSubject(`${group.subject} (Class ${classFilter})`, group.topics)
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add to tracker
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mt-6" data-tour="tour-syllabus-add">
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
          <Button
            onClick={handleParse}
            disabled={loading || !raw.trim()}
            className="mt-3 w-full bg-gradient-primary"
          >
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
                  if (newSubject.trim()) {
                    addSubject(newSubject);
                    setNewSubject("");
                  }
                }
              }}
            />
            <Button
              variant="secondary"
              onClick={() => {
                if (newSubject.trim()) {
                  addSubject(newSubject);
                  setNewSubject("");
                }
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

      <div className="mt-8 space-y-4" data-tour="tour-syllabus-progress">
        {subjects.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
            No subjects yet. Paste a syllabus or add one above.
          </div>
        ) : (
          subjects.map((s) => {
            const done = s.topics.filter((t) => t.done).length;
            const pct = s.topics.length ? Math.round((done / s.topics.length) * 100) : 0;
            return (
              <SubjectCard
                key={s.id}
                subject={s}
                pct={pct}
                done={done}
                onToggle={toggleTopic}
                onAddTopic={addTopic}
                onRemove={removeSubject}
                onRemoveTopic={removeTopic}
              />
            );
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
          <span className="text-xs text-muted-foreground">
            {done}/{subject.topics.length} · {pct}%
          </span>
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
          // Use div instead of label to prevent the trash-icon click from also
          // triggering the implicit label→checkbox toggle (label+button interaction bug).
          <div
            key={t.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer group"
            onClick={() => onToggle(subject.id, t.id)}
          >
            <Checkbox
              checked={t.done}
              onCheckedChange={() => {}}
              onClick={(e) => e.stopPropagation()}
            />
            <span className={t.done ? "line-through text-muted-foreground flex-1" : "flex-1"}>
              {t.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveTopic(subject.id, t.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Add a topic…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (topic.trim()) {
                onAddTopic(subject.id, topic);
                setTopic("");
              }
            }
          }}
        />
        <Button
          variant="secondary"
          onClick={() => {
            if (topic.trim()) {
              onAddTopic(subject.id, topic);
              setTopic("");
            }
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
