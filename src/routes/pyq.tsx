import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, ChevronRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ExamResources } from "@/components/ExamResources";
import {
  filterBank,
  isCorrectBankAnswer,
  loadQuestionBank,
  hasImportedQuestionBank,
  drawBankQuestions,
  resetQuestionHistory,
  type BankQuestion,
} from "@/lib/question-bank";

export const Route = createFileRoute("/pyq")({
  head: () => ({
    meta: [
      { title: "Question Bank — Study Buddy" },
      {
        name: "description",
        content:
          "Find sourced questions, official practice banks and study materials for CBSE Class 10, JEE, NEET, UPSC, SAT and GRE.",
      },
    ],
  }),
  component: QuestionBankPage,
});

const EXAMS = {
  "cbse-class-10": "CBSE Class 10 Board Exam",
  jee: "Mixed JEE",
  "jee-main": "JEE Main",
  "jee-advanced": "JEE Advanced",
  neet: "NEET UG",
  "upsc-prelims": "UPSC Prelims",
  sat: "SAT",
  gre: "GRE",
};

function Source({ question: q }: { question: BankQuestion }) {
  return (
    <div className="text-xs text-muted-foreground space-y-1">
      <p>
        {q.subject} · {q.year ?? "Year unavailable"} ·{" "}
        {q.source.kind === "pyq"
          ? "Previous-year question"
          : "Practice collection · paper provenance unverified"}
      </p>
    </div>
  );
}

function QuestionBankPage() {
  const [exam, setExam] = useState("jee");
  const { data: profile } = useQuery({ queryKey: ["userProfile"], queryFn: api.getUserProfile });
  const examChosen = useRef(false);
  useEffect(() => {
    if (!examChosen.current && profile?.exam_id && profile.exam_id in EXAMS)
      setExam(profile.exam_id);
  }, [profile?.exam_id]);
  const hasImportedBank = hasImportedQuestionBank(exam);
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState("");
  const [search, setSearch] = useState("");
  const [pyqOnly, setPyqOnly] = useState(false);
  const [visible, setVisible] = useState(25);
  const [practice, setPractice] = useState<BankQuestion[] | null>(null);
  const [selecting, setSelecting] = useState(false);
  const bank = useQuery({
    queryKey: ["questionBank", exam],
    queryFn: () => loadQuestionBank(exam),
    staleTime: Infinity,
    retry: false,
  });
  const questions = filterBank(bank.data ?? [], {
    subject,
    search,
    year: year ? Number(year) : undefined,
    pyqOnly,
  });
  const years = [...new Set((bank.data ?? []).flatMap((q) => (q.year ? [q.year] : [])))].sort(
    (a, b) => b - a,
  );
  useEffect(() => setVisible(25), [exam, subject, year, search, pyqOnly]);
  if (practice) return <Practice questions={practice} onClose={() => setPractice(null)} />;
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-3xl font-bold">Question Bank</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Sourced questions and answer keys. No AI-generated questions.
          </p>
        </div>
        <Button
          disabled={!questions.length || selecting}
          onClick={async () => {
            setSelecting(true);
            try {
              const selected = await drawBankQuestions(questions, 10, true);
              if (!selected.length)
                throw new Error(
                  "No unseen questions match. Broaden your filters or intentionally reset history to allow repeats.",
                );
              setPractice(selected);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to select questions");
            } finally {
              setSelecting(false);
            }
          }}
        >
          {selecting ? "Syncing history…" : "Practice unseen questions"}
        </Button>
      </div>
      <div className="card-light rounded-2xl p-4 text-sm space-y-2">
        <p>
          New selections skip questions already chosen by your account across devices. History syncs
          when you start an attempt. Saved attempts and review can repeat intentionally.
        </p>
        <Button
          variant="outline"
          className="max-w-full whitespace-normal h-auto py-2"
          disabled={selecting}
          onClick={async () => {
            setSelecting(true);
            try {
              await resetQuestionHistory();
              toast.success(
                "History reset across devices. Previously selected questions can appear again.",
              );
            } catch {
              toast.error("Unable to sync the history reset. Please try again.");
            } finally {
              setSelecting(false);
            }
          }}
        >
          Allow repeats: reset history
        </Button>
        <p>
          <strong>{bank.data?.length ?? "…"} imported questions</strong> available for{" "}
          {EXAMS[exam as keyof typeof EXAMS]}.
        </p>
        {hasImportedBank ? (
          <p className="text-muted-foreground">
            {exam === "neet"
              ? "NEET coverage includes Physics, Chemistry and Biology from a curated 2021–2024 collection. Supplied keys have not been independently checked against every NTA booklet. Study notes, ambiguous mock records and missing diagrams are excluded."
              : "Current JEE coverage includes Main mathematics and Advanced Physics, Chemistry and Mathematics. Missing answers, unavailable diagrams and the unverified community collection are excluded."}{" "}
            This is not a complete exam archive.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Official study materials, question banks and papers are listed below. In-app quizzes
            and timed mocks are not available for this exam yet.
          </p>
        )}
        <a className="text-primary underline" href="/sources">
          Sources and attribution
        </a>
      </div>
      <div className="card-light rounded-2xl p-4 flex flex-wrap gap-3">
        <select
          aria-label="Exam"
          className="rounded-lg border p-2 bg-background"
          value={exam}
          onChange={(e) => {
            examChosen.current = true;
            setExam(e.target.value);
            setSubject("");
            setYear("");
          }}
        >
          {Object.entries(EXAMS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Subject"
          className="rounded-lg border p-2 bg-background"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="">All subjects</option>
          {[...new Set((bank.data ?? []).map((q) => q.subject))].sort().map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Year"
          className="rounded-lg border p-2 bg-background"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pyqOnly} onChange={(e) => setPyqOnly(e.target.checked)} />
          Previous-year questions only
        </label>
        <input
          aria-label="Search questions"
          placeholder="Search topic or question…"
          className="w-full min-w-0 rounded-lg border p-2 bg-background"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {bank.isPending ? (
        <p role="status">Loading question bank…</p>
      ) : bank.isError ? (
        <div role="alert">
          <p>Unable to load the question bank.</p>
          <Button onClick={() => void bank.refetch()}>Try again</Button>
        </div>
      ) : !questions.length ? (
        <p className="card-light rounded-2xl p-8">
          {hasImportedBank
            ? "No matching questions. Broaden your filters. AI question generation is disabled."
            : "Open the official study materials and practice resources below. In-app practice questions are not imported for this exam yet."}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {questions.length} matching questions · showing {Math.min(visible, questions.length)}
          </p>
          {questions.slice(0, visible).map((q) => (
            <QuestionCard key={q.id} question={q} />
          ))}
          {visible < questions.length && (
            <Button variant="outline" onClick={() => setVisible((v) => v + 25)}>
              Show 25 more
            </Button>
          )}
        </>
      )}
      {!hasImportedBank && <ExamResources key={exam} examId={exam} />}
    </div>
  );
}

function QuestionCard({ question: q }: { question: BankQuestion }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="card-light rounded-2xl p-4 space-y-3">
      <Source question={q} />
      <MarkdownContent content={q.question} />
      <p className="text-xs text-muted-foreground">
        {q.question_type === "multiple"
          ? "Select all correct answers"
          : q.question_type === "integer"
            ? "Numerical answer"
            : "Single correct answer"}
      </p>
      {q.options?.map((o, i) => (
        <div key={i} className="flex gap-2 text-sm">
          <span>{String.fromCharCode(65 + i)}.</span>
          <MarkdownContent content={o} />
        </div>
      ))}
      {open && (
        <div className="rounded-xl bg-muted p-3 space-y-2">
          <strong>Answer key</strong>
          <MarkdownContent content={q.answer} />
          {q.explanation ? (
            <MarkdownContent content={q.explanation} />
          ) : (
            <p className="text-sm text-muted-foreground">
              This source provides an answer key without a worked solution.
            </p>
          )}
          <Link
            className="text-sm text-primary underline"
            to="/chat"
            search={{
              q: `Explain this existing question without creating any new questions:\n${q.question}\nOptions: ${q.options.join("; ")}\nSource answer key: ${q.answer}`,
            }}
          >
            Ask AI to explain this question
          </Link>
        </div>
      )}
      <button className="text-sm text-primary underline" onClick={() => setOpen(!open)}>
        {open ? "Hide answer" : "Show answer and solution"}
      </button>
    </article>
  );
}

function Practice({ questions, onClose }: { questions: BankQuestion[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [numeric, setNumeric] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);
  const reported = useRef(false);
  const q = questions[index];
  useEffect(() => {
    if (!done || reported.current) return;
    reported.current = true;
    const groups = new Map<
      string,
      { subject: string; topic: string; question_count: number; correct_count: number }
    >();
    questions.forEach((question, i) => {
      const topic = question.topic || question.subject;
      const key = `${question.subject}::${topic}`;
      const group = groups.get(key) ?? {
        subject: question.subject,
        topic,
        question_count: 0,
        correct_count: 0,
      };
      group.question_count += 1;
      group.correct_count += results[i] ? 1 : 0;
      groups.set(key, group);
    });
    void Promise.all([...groups.values()].map((group) => api.upsertPerformanceLog(group)))
      .then(() => qc.invalidateQueries({ queryKey: ["perfLogs"] }))
      .catch(() =>
        toast.error(
          "Practice finished, but progress could not be synced. Your results are still shown here.",
        ),
      );
  }, [done, questions, results, qc]);
  if (done)
    return (
      <div className="max-w-xl mx-auto p-6 text-center space-y-5">
        <h1 className="text-3xl font-bold">Practice complete</h1>
        <p>
          {results.filter(Boolean).length} / {questions.length} correct
        </p>
        <Button onClick={onClose}>
          <RotateCcw size={16} /> Back to bank
        </Button>
      </div>
    );
  const submit = () => {
    if (revealed) return;
    setResults((v) => [...v, isCorrectBankAnswer(q, selected, numeric)]);
    setRevealed(true);
  };
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex justify-between gap-2">
        <h1 className="text-xl font-bold">
          Question {index + 1} of {questions.length}
        </h1>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      <Source question={q} />
      <MarkdownContent content={q.question} />
      <p className="text-sm text-muted-foreground">
        {q.question_type === "multiple"
          ? "Select every correct option, then check your answer."
          : q.question_type === "integer"
            ? "Enter the numerical answer."
            : "Select one answer."}
      </p>
      {q.question_type === "integer" ? (
        <input
          aria-label="Numerical answer"
          inputMode="decimal"
          className="w-full rounded-xl border bg-background p-3"
          value={numeric}
          disabled={revealed}
          onChange={(e) => setNumeric(e.target.value)}
        />
      ) : (
        q.options.map((o, i) => (
          <div
            key={i}
            role="button"
            tabIndex={revealed ? -1 : 0}
            aria-pressed={selected.includes(i)}
            className={`border rounded-xl p-3 cursor-pointer ${selected.includes(i) ? "border-primary bg-accent" : ""}`}
            onClick={() => {
              if (!revealed)
                setSelected((old) =>
                  q.question_type === "multiple"
                    ? old.includes(i)
                      ? old.filter((x) => x !== i)
                      : [...old, i]
                    : [i],
                );
            }}
            onKeyDown={(e) => {
              if (!revealed && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                setSelected((old) =>
                  q.question_type === "multiple"
                    ? old.includes(i)
                      ? old.filter((x) => x !== i)
                      : [...old, i]
                    : [i],
                );
              }
            }}
          >
            <MarkdownContent content={`${String.fromCharCode(65 + i)}. ${o}`} />
          </div>
        ))
      )}
      {!revealed ? (
        <Button
          disabled={q.question_type === "integer" ? !numeric.trim() : !selected.length}
          onClick={submit}
        >
          Check answer
        </Button>
      ) : (
        <div className="space-y-4 rounded-xl bg-muted p-4">
          <p className="font-semibold">{results.at(-1) ? "Correct" : "Incorrect"}</p>
          <MarkdownContent content={q.answer} />
          {q.explanation && <MarkdownContent content={q.explanation} />}
          <Button
            onClick={() => {
              if (index + 1 === questions.length) setDone(true);
              else {
                setIndex((i) => i + 1);
                setSelected([]);
                setNumeric("");
                setRevealed(false);
              }
            }}
          >
            {index + 1 === questions.length ? "See results" : "Next question"}
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
