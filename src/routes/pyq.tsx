import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type PYQQuestion } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BookOpen,
  Search,
  Filter,
  Zap,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  RotateCcw,
  Trophy,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTutorial } from "@/components/TutorialProvider";

export const Route = createFileRoute("/pyq")({
  head: () => ({
    meta: [
      { title: "PYQ Bank · AcePrep" },
      {
        name: "description",
        content:
          "Previous Year Questions for JEE, NEET and more — practice or generate AI-powered PYQ-style questions",
      },
    ],
  }),
  component: PYQPage,
});

const EXAMS = ["jee-main", "jee-advanced", "neet", "upsc", "cat"];
const EXAM_LABELS: Record<string, string> = {
  "jee-main": "JEE Main",
  "jee-advanced": "JEE Advanced",
  neet: "NEET",
  upsc: "UPSC",
  cat: "CAT",
};
const SUBJECTS: Record<string, string[]> = {
  "jee-main": ["Physics", "Chemistry", "Mathematics"],
  "jee-advanced": ["Physics", "Chemistry", "Mathematics"],
  neet: ["Physics", "Chemistry", "Biology"],
  upsc: ["GS Paper 1", "GS Paper 2", "GS Paper 3", "GS Paper 4"],
  cat: ["Verbal", "Quantitative", "DILR"],
};
const YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018];
const DIFFICULTIES = ["easy", "medium", "hard"];

type PracticeState = {
  questions: PYQQuestion[];
  current: number;
  selected: number | null;
  revealed: boolean;
  score: number;
  done: boolean;
};

function PYQPage() {
  const qc = useQueryClient();
  const [examId, setExamId] = useState("jee-main");
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState<number | "">("");
  const [difficulty, setDifficulty] = useState("");
  const [search, setSearch] = useState("");
  const [practicing, setPracticing] = useState<PracticeState | null>(null);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const { triggerPageTour } = useTutorial();

  useEffect(() => {
    triggerPageTour("pyq");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["pyq", examId, subject, year, difficulty, search],
    queryFn: () =>
      api.getPYQQuestions({
        exam_id: examId,
        subject: subject || undefined,
        year: year ? Number(year) : undefined,
        difficulty: difficulty || undefined,
        search: search || undefined,
      }),
  });

  const saveMutation = useMutation({
    mutationFn: api.savePYQQuestions,
    onError: (error) => toast.error(error.message || "Operation failed"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pyq"] }),
  });

  // Generate AI PYQ-style questions
  const handleGenerate = async () => {
    if (!topic.trim()) return toast.error("Enter a topic to generate questions");
    setGenerating(true);
    try {
      const examLabel = EXAM_LABELS[examId] || examId;
      const yearLabel = year || new Date().getFullYear();
      const subjectLabel = subject || (SUBJECTS[examId]?.[0] ?? "General");

      // Use study-ai generateQuiz action
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "generateQuiz",
          data: {
            topic: `${topic} (${subjectLabel})`,
            count: 5,
            difficulty: difficulty || "hard",
            examName: examLabel,
          },
        }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      type AIQuestion = {
        question: string;
        options: string[];
        answerIndex?: number;
        answer?: string;
        explanation?: string;
      };
      const qs: Omit<PYQQuestion, "id">[] = (result.questions || []).map((q: AIQuestion) => ({
        exam_id: examId,
        year: Number(yearLabel),
        subject: subjectLabel,
        topic: topic.trim(),
        question: q.question,
        question_type: "mcq",
        options: q.options,
        answer: q.options?.[q.answerIndex ?? -1] || q.answer || "",
        explanation: q.explanation,
        difficulty: (difficulty || "hard") as "easy" | "medium" | "hard",
        tags: [topic.trim(), subjectLabel],
      }));

      await saveMutation.mutateAsync(qs);
      toast.success(`✅ Generated ${qs.length} ${examLabel} questions for ${topic}`);
      setTopic("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // Start practice mode
  const handlePractice = () => {
    if (questions.length === 0) return toast.error("No questions to practice");
    setPracticing({
      questions: [...questions].sort(() => Math.random() - 0.5).slice(0, 10),
      current: 0,
      selected: null,
      revealed: false,
      score: 0,
      done: false,
    });
  };

  if (practicing) {
    return <PracticeMode state={practicing} setState={setPracticing} />;
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow-sm">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">PYQ Bank</h1>
            <p className="text-sm text-muted-foreground">
              Previous Year Questions · AI-powered generation
            </p>
          </div>
        </div>
        {questions.length > 0 && (
          <Button onClick={handlePractice} className="bg-gradient-primary gap-2 shrink-0">
            <Brain className="h-4 w-4" /> Practice ({Math.min(10, questions.length)})
          </Button>
        )}
      </div>

      {/* AI Generate strip */}
      <div
        className="glass-card rounded-2xl p-4 mb-6 border border-primary/20"
        data-tour="tour-pyq-generate"
      >
        <p className="text-sm font-medium mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Generate AI-powered PYQ-style questions
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            placeholder="Topic (e.g. Electromagnetic Induction)"
            className="flex-1 min-w-[200px] glass-subtle rounded-xl px-3 py-2 text-sm bg-transparent outline-none"
          />
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-gradient-primary gap-2"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {generating ? "Generating…" : "Generate 5 Qs"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4 mb-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-muted-foreground" /> Filters
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Exam */}
          {EXAMS.map((e) => (
            <button
              key={e}
              onClick={() => {
                setExamId(e);
                setSubject("");
              }}
              className={cn(
                "px-3 py-1 rounded-full text-xs border transition-all",
                examId === e
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "glass-subtle text-muted-foreground hover:text-foreground",
              )}
            >
              {EXAM_LABELS[e]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Subject */}
          <button
            onClick={() => setSubject("")}
            className={cn(
              "px-3 py-1 rounded-full text-xs border transition-all",
              !subject
                ? "bg-primary/15 text-primary border-primary/30"
                : "glass-subtle text-muted-foreground",
            )}
          >
            All subjects
          </button>
          {(SUBJECTS[examId] || []).map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s === subject ? "" : s)}
              className={cn(
                "px-3 py-1 rounded-full text-xs border transition-all",
                subject === s
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "glass-subtle text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}
            className="glass-subtle rounded-lg px-3 py-1.5 text-xs bg-transparent outline-none border border-border"
          >
            <option value="">All years</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d === difficulty ? "" : d)}
              className={cn(
                "px-3 py-1 rounded-full text-xs border transition-all capitalize",
                difficulty === d
                  ? d === "hard"
                    ? "bg-red-500/15 text-red-400 border-red-500/30"
                    : d === "medium"
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "glass-subtle text-muted-foreground hover:text-foreground",
              )}
            >
              {d}
            </button>
          ))}
          <div className="flex items-center gap-2 flex-1 min-w-[160px] glass-subtle rounded-xl px-3 py-1.5">
            <Search className="h-3 w-3 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions…"
              className="bg-transparent text-xs outline-none flex-1"
            />
          </div>
        </div>
      </div>

      {/* Question list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 glass-card rounded-xl animate-pulse" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <BookOpen className="h-12 w-12 text-primary/20 mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">No questions found</p>
          <p className="text-sm text-muted-foreground mb-6">
            Generate some using the AI tool above, or adjust your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {questions.length} question{questions.length !== 1 ? "s" : ""} found
          </p>
          {questions.map((q, i) => (
            <QuestionCard key={q.id} question={q} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionCard({ question: q, index }: { question: PYQQuestion; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const diffColor =
    q.difficulty === "hard"
      ? "text-red-400 bg-red-500/10 border-red-500/20"
      : q.difficulty === "medium"
        ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
        : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-xs text-muted-foreground shrink-0 mt-0.5">Q{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="text-xs text-muted-foreground">
              {q.exam_id?.toUpperCase()} · {q.year} · {q.subject}
            </span>
            <span
              className={cn("text-[10px] px-2 py-0.5 rounded-full border capitalize", diffColor)}
            >
              {q.difficulty}
            </span>
          </div>
          <p className="text-sm leading-relaxed">{q.question}</p>
          {expanded && q.options && (
            <div className="mt-3 space-y-1.5">
              {q.options.map((opt, oi) => (
                <div
                  key={oi}
                  className={cn(
                    "text-sm px-3 py-2 rounded-lg border",
                    opt === q.answer
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "glass-subtle",
                  )}
                >
                  {opt === q.answer && <CheckCircle2 className="inline h-3.5 w-3.5 mr-1.5" />}
                  {opt}
                </div>
              ))}
              {q.explanation && (
                <p className="text-xs text-muted-foreground mt-2 p-3 bg-muted/20 rounded-lg">
                  {q.explanation}
                </p>
              )}
            </div>
          )}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 text-xs text-primary hover:underline"
          >
            {expanded ? "Hide answer" : "Show answer & explanation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PracticeMode({
  state,
  setState,
}: {
  state: PracticeState;
  setState: (s: PracticeState | null) => void;
}) {
  const q = state.questions[state.current];
  const total = state.questions.length;

  if (state.done) {
    const pct = Math.round((state.score / total) * 100);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-10 text-center max-w-md w-full">
          <div className="text-5xl mb-4">{pct >= 70 ? "🎉" : pct >= 40 ? "💪" : "📚"}</div>
          <h2 className="text-2xl font-bold mb-1">Practice Complete!</h2>
          <p className="text-muted-foreground mb-6">
            {state.score}/{total} correct · {pct}% accuracy
          </p>
          <div className="h-3 bg-muted/30 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-gradient-primary rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() =>
                setState({
                  ...state,
                  current: 0,
                  selected: null,
                  revealed: false,
                  score: 0,
                  done: false,
                })
              }
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Try again
            </Button>
            <Button onClick={() => setState(null)} className="bg-gradient-primary">
              Back to bank
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSelect = (idx: number) => {
    if (state.revealed) return;
    const correct = q.options?.[idx] === q.answer;
    setState({ ...state, selected: idx, revealed: true, score: state.score + (correct ? 1 : 0) });
  };

  const handleNext = () => {
    const next = state.current + 1;
    if (next >= total) setState({ ...state, current: next, done: true });
    else setState({ ...state, current: next, selected: null, revealed: false });
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>
            Question {state.current + 1} of {total}
          </span>
          <span>{state.score} correct</span>
        </div>
        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-primary rounded-full transition-all"
            style={{ width: `${(state.current / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-5">
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{q.exam_id?.toUpperCase()}</span>
          <span>·</span>
          <span>{q.year}</span>
          <span>·</span>
          <span>{q.subject}</span>
        </div>
        <p className="text-base leading-relaxed font-medium">{q.question}</p>
        <div className="space-y-2">
          {(q.options || []).map((opt, idx) => {
            const isSelected = state.selected === idx;
            const isCorrect = opt === q.answer;
            let cls = "glass-subtle border text-sm";
            if (state.revealed) {
              cls = isCorrect
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : isSelected
                  ? "bg-red-500/15 border-red-500/40 text-red-300"
                  : "glass-subtle border opacity-50";
            } else if (isSelected) cls = "bg-primary/15 border-primary/40 text-primary";
            return (
              <button
                key={idx}
                onClick={() => handleSelect(idx)}
                disabled={state.revealed}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3",
                  cls,
                )}
              >
                {state.revealed && isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                {state.revealed && isSelected && !isCorrect && (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
        {state.revealed && q.explanation && (
          <div className="p-4 bg-muted/20 rounded-xl text-sm text-muted-foreground border border-muted/30">
            <span className="font-medium text-foreground">Explanation: </span>
            {q.explanation}
          </div>
        )}
        {state.revealed && (
          <Button onClick={handleNext} className="w-full bg-gradient-primary">
            {state.current + 1 >= total ? "See Results" : "Next Question"}{" "}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
