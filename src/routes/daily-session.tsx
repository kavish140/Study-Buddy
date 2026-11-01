import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { todayIST } from "@/lib/date-utils";
import {
  accuracyComparison,
  dailySessionInputs,
  sessionBudget,
  type SessionMinutes,
  type TopicBaseline,
} from "@/lib/daily-session";
import {
  drawBankQuestions,
  filterBank,
  loadQuestionBank,
  toQuizQuestion,
  type BankQuestion,
} from "@/lib/question-bank";
import { uid, type PlanItem, type ReviewCard } from "@/lib/storage";
import { structuredTopicMatches } from "@/lib/quiz-search";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useAuth } from "@/hooks/use-auth";
import { DailySessionCoach } from "@/components/DailySessionCoach";
import { coachMaterial, coachTopicResults } from "@/lib/session-coach";

export const Route = createFileRoute("/daily-session")({
  head: () => ({
    meta: [
      { title: "Daily Session · Study Buddy" },
      {
        name: "description",
        content: "A personalized session of review, targeted practice, and focused study.",
      },
    ],
  }),
  component: DailySessionPage,
});

type Session = {
  id: string;
  started: number;
  minutes: SessionMinutes;
  cards: ReviewCard[];
  questions: BankQuestion[];
  task: PlanItem | null;
  baseline: TopicBaseline[];
  notice: string;
};
type Stage = "setup" | "review" | "practice" | "task" | "summary";
const stages: Stage[] = ["review", "practice", "task", "summary"];

function DailySessionPage() {
  const { user } = useAuth();
  return <DailySessionContent key={user?.id ?? "signed-out"} />;
}

function DailySessionContent() {
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["dailySessionInputs"],
    queryFn: async () => {
      const [profile, cards, plan, logs, mocks, quizzes] = await Promise.all([
        api.getUserProfile(),
        api.getDueReviewCards(),
        api.getPlan(),
        api.getPerformanceLogs(),
        api.getMockTests(),
        api.getQuizzes(),
      ]);
      return {
        profile,
        logs,
        ...dailySessionInputs(todayIST(), cards, plan, logs, mocks, quizzes),
      };
    },
    staleTime: 0,
  });
  const [minutes, setMinutes] = useState<SessionMinutes>(30);
  const [session, setSession] = useState<Session | null>(null);
  const [stage, setStage] = useState<Stage>("setup");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [cardIndex, setCardIndex] = useState(0);
  const [recalled, setRecalled] = useState(0);
  const [lastRating, setLastRating] = useState<number | null>(null);
  const [monitoring, setMonitoring] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [taskDone, setTaskDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerAnchor = useRef(Date.now());
  const elapsedAnchor = useRef(0);
  const practiceSaved = useRef(false);
  const active = stage !== "setup" && stage !== "summary";

  useEffect(() => {
    if (!active || paused) return;
    timerAnchor.current = Date.now();
    elapsedAnchor.current = elapsed;
    const interval = window.setInterval(
      () =>
        setElapsed(elapsedAnchor.current + Math.floor((Date.now() - timerAnchor.current) / 1000)),
      1000,
    );
    return () => window.clearInterval(interval);
    // Reset the anchor only when starting, pausing, or changing steps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused, stage]);
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);

  function advance(current: Stage, s = session) {
    if (!s) return;
    const next = stages
      .slice(stages.indexOf(current) + 1)
      .find(
        (step) =>
          step === "summary" ||
          (step === "review" && s.cards.length) ||
          (step === "practice" && s.questions.length) ||
          (step === "task" && s.task),
      );
    setStage(next ?? "summary");
    setError("");
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save. Please try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const refresh = () => {
    ["dailySessionInputs", "reviewCards", "allReviewCards", "quizzes", "perfLogs", "plan"].forEach(
      (key) => {
        void qc.invalidateQueries({ queryKey: [key] });
      },
    );
  };
  async function start() {
    await run(async () => {
      const fresh = await data.refetch();
      if (fresh.error) throw fresh.error;
      const input = fresh.data;
      if (!input?.profile) throw new Error("Load your exam profile before starting a session.");
      const budget = sessionBudget(minutes);
      const bank = filterBank(await loadQuestionBank(input.profile.exam_id), { mcqOnly: true });
      const focusedIds = new Set(
        input.weakTopics.flatMap((t) =>
          structuredTopicMatches(bank, t.topic)
            .filter((q) => !t.subject || t.subject === q.subject)
            .map((q) => q.id),
        ),
      );
      const focused = bank.filter((q) => focusedIds.has(q.id));
      const pool = focused.length ? focused : bank;
      const questions = pool.length ? await drawBankQuestions(pool, budget.questions, true) : [];
      if (focused.length && questions.length < budget.questions) {
        const extra = bank.filter((q) => !focusedIds.has(q.id));
        if (extra.length)
          questions.push(
            ...(await drawBankQuestions(extra, budget.questions - questions.length, true)),
          );
      }
      const s: Session = {
        id: uid(),
        started: Date.now(),
        minutes,
        cards: input.cards.slice(0, budget.cards),
        questions,
        task: input.task,
        baseline: input.baseline,
        notice: !questions.length
          ? "No unseen practice questions are available for your exam. This session uses your reviews and planned task."
          : focused.length
            ? "Practice prioritizes topics with past accuracy below 70%, with mixed practice when needed."
            : "No matching weak-topic questions yet. This session includes mixed practice to build a baseline.",
      };
      if (!s.cards.length && !s.questions.length && !s.task)
        throw new Error(
          "Nothing is ready yet. Add a task in Planner or flashcards in Smart Review, then come back.",
        );
      setSession(s);
      setStage(s.cards.length ? "review" : s.questions.length ? "practice" : "task");
    });
  }
  async function rate(rating: 0 | 1 | 3 | 5) {
    if (!session) return;
    await run(async () => {
      await api.updateReviewCard(session.cards[cardIndex].id, rating);
      setLastRating(rating);
      setCardIndex((i) => i + 1);
      if (rating >= 3) setRecalled((n) => n + 1);
      setRevealed(false);
      refresh();
      if (cardIndex + 1 === session.cards.length) advance("review");
    });
  }
  async function finishPractice() {
    if (!session) return;
    await run(async () => {
      const score = session.questions.filter((q, i) => q.correct_options[0] === answers[i]).length;
      if (!practiceSaved.current) {
        await api.saveQuiz({
          id: session.id,
          topic: "Daily session",
          createdAt: session.started,
          questions: session.questions.map(toQuizQuestion),
          score,
        });
        practiceSaved.current = true;
      }
      const groups = new Map<
        string,
        { subject: string; topic: string; question_count: number; correct_count: number }
      >();
      session.questions.forEach((q, i) => {
        const topic = q.topic || q.subject,
          key = `${q.subject}::${topic}`;
        const group = groups.get(key) ?? {
          subject: q.subject,
          topic,
          question_count: 0,
          correct_count: 0,
        };
        group.question_count++;
        if (answers[i] === q.correct_options[0]) group.correct_count++;
        groups.set(key, group);
      });
      // The existing API stores the most recent topic attempt, as diagnostics do.
      for (const group of groups.values()) await api.upsertPerformanceLog(group);
      refresh();
      advance("practice");
    });
  }

  const remaining = Math.max(0, minutes * 60 - elapsed);
  const clock = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  const q = session?.questions[questionIndex];
  const card = session?.cards[cardIndex];
  const results =
    session?.questions.map((question, i) => ({
      subject: question.subject,
      topic: question.topic || question.subject,
      correct: answers[i] === question.correct_options[0],
    })) ?? [];
  const comparison = accuracyComparison(session?.baseline ?? [], results);
  const panel = "rounded-2xl border border-border bg-card p-5 sm:p-7 space-y-5";

  return (
    <div className="max-w-3xl mx-auto px-5 py-8 space-y-6 animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-primary text-sm font-medium flex items-center gap-2">
            <Sparkles size={16} /> Your next step, ready
          </p>
          <h1 className="text-3xl font-bold tracking-tight mt-2">Daily Session</h1>
          <p className="text-muted-foreground mt-2">
            Review what’s due. Practice what’s difficult. Move your plan forward.
          </p>
        </div>
        <Brain className="text-primary shrink-0 mt-2" size={28} />
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      {session && (
        <DailySessionCoach
          contextKey={`${session.id}:${stage}:${cardIndex}:${revealed}:${questionIndex}:${checked}:${taskDone}`}
          examName={data.data?.profile?.exam_name}
          paused={paused}
          saving={busy}
          monitoring={monitoring}
          onMonitoringChange={setMonitoring}
          snapshot={{
            stage,
            nextAction:
              stage === "review"
                ? revealed
                  ? "Rate this card: Again, Hard, Good, or Easy"
                  : "Recall the answer, then select Reveal answer"
                : stage === "practice"
                  ? questionIndex >= session.questions.length
                    ? "Save practice & continue"
                    : checked
                      ? "Read the explanation, then Continue"
                      : "Choose an answer, then Check answer"
                  : stage === "task"
                    ? "Work on the planned task, then Mark task complete or Leave task for later"
                    : "Read the recap or return to dashboard",
            budgetMinutes: session.minutes,
            remainingSeconds: remaining,
            reviewed: cardIndex,
            recalled,
            totalCards: session.cards.length,
            questionNumber: Math.min(questionIndex + 1, session.questions.length),
            totalQuestions: session.questions.length,
            answered: answers.length,
            correct: results.filter((r) => r.correct).length,
            topicResults: coachTopicResults(session.questions, answers),
            weakTopics: session.baseline
              .filter((t) => t.correct / t.total < 0.7)
              .slice(0, 5)
              .map((t) => ({
                subject: t.subject,
                topic: t.topic,
                accuracy: Math.round((t.correct / t.total) * 100),
              })),
            lastRating,
            material: coachMaterial(stage, card, revealed, q, checked, choice),
            task: session.task?.task.slice(0, 2000) ?? null,
            taskDone,
            comparison: stage === "summary" ? comparison : null,
          }}
        />
      )}
      {stage === "setup" && (
        <div className={panel}>
          <h2 className="text-lg font-semibold">How much time do you have?</h2>
          <div className="grid grid-cols-3 gap-3">
            {([15, 30, 60] as const).map((n) => (
              <button
                key={n}
                disabled={busy}
                aria-pressed={minutes === n}
                onClick={() => setMinutes(n)}
                className={`rounded-xl border p-4 transition-colors ${minutes === n ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
              >
                <span className="text-2xl font-bold">{n}</span>
                <span className="block text-sm">minutes</span>
              </button>
            ))}
          </div>
          {data.isPending ? (
            <p role="status">Loading your study progress…</p>
          ) : data.isError ? (
            <div>
              <p>Couldn’t load your study progress.</p>
              <Button variant="outline" onClick={() => void data.refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <ol className="space-y-3 text-sm">
                <li>
                  <strong>1. Recall</strong> · Up to{" "}
                  {Math.min(data.data.cards.length, sessionBudget(minutes).cards)} due flashcards
                </li>
                <li>
                  <strong>2. Practice</strong> · Up to {sessionBudget(minutes).questions} questions
                  {data.data.weakTopics.length
                    ? " focused on your weaker topics"
                    : " to establish your baseline"}
                </li>
                <li>
                  <strong>3. Focus</strong> ·{" "}
                  {data.data.task?.task ??
                    "No pending task — add one in Planner to include focused study"}
                </li>
              </ol>
              <p className="text-xs text-muted-foreground">
                A suggested time budget, at your pace. Missing steps are skipped. Completed steps
                save to your account; keep this page open to retain your session recap.
              </p>
              <div className="rounded-xl bg-muted p-4 space-y-2 text-sm">
                <p>
                  Your AI companion will guide each step and offer timely help while you’re active.
                </p>
                <label className="flex items-start gap-2">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={monitoring}
                    onChange={(e) => setMonitoring(e.target.checked)}
                  />
                  <span>
                    Share on-page activity summaries with the coach: mouse patterns,
                    click/scroll/key counts, tab departures, and time without progress.
                  </span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Activity monitoring doesn’t record what you type, screenshots, or other apps. You
                  can turn it off anytime. Summaries are sent with AI coaching requests.
                </p>
              </div>
              <Button className="w-full" disabled={busy} onClick={() => void start()}>
                {busy ? "Preparing your session…" : "Start my study session"}
              </Button>
            </>
          )}
          <div className="flex gap-4 text-sm text-primary">
            <Link to="/planner">Open Planner</Link>
            <Link to="/review">Open Smart Review</Link>
          </div>
        </div>
      )}
      {active && session && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted p-4">
            <p className="text-sm font-medium flex items-center gap-2">
              <Clock size={16} />{" "}
              {remaining ? `${clock} remaining` : "Time budget reached — finish at your pace"}
            </p>
            <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)}>
              {paused ? "Resume" : "Pause"}
            </Button>
          </div>
          <ol aria-label="Session progress" className="flex gap-2 text-xs sm:text-sm">
            {[
              ["review", "Recall"],
              ["practice", "Practice"],
              ["task", "Focus"],
            ].map(([step, label]) => (
              <li
                key={step}
                aria-current={stage === step ? "step" : undefined}
                className={`flex-1 rounded-lg p-3 text-center ${stage === step ? "bg-primary/10 text-primary font-semibold" : "bg-muted text-muted-foreground"}`}
              >
                {label}
              </li>
            ))}
          </ol>
          {session.notice && <p className="text-sm text-muted-foreground">{session.notice}</p>}
          {paused ? (
            <div className={panel}>
              <h2 className="font-semibold">Session paused</h2>
              <p className="text-muted-foreground">Take a breather. Resume when you’re ready.</p>
            </div>
          ) : (
            <>
              {stage === "review" && card && (
                <div className={panel}>
                  <p className="text-sm text-muted-foreground">
                    Recall · Card {cardIndex + 1} of {session.cards.length}
                  </p>
                  <MarkdownContent content={card.question} />
                  {revealed ? (
                    <>
                      <div className="rounded-xl bg-muted p-4 space-y-3">
                        <MarkdownContent content={card.answer} />
                        {card.explanation && <MarkdownContent content={card.explanation} />}
                      </div>
                      <p className="text-sm">How well did you recall it?</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(
                          [
                            [0, "Again"],
                            [1, "Hard"],
                            [3, "Good"],
                            [5, "Easy"],
                          ] as const
                        ).map(([rating, label]) => (
                          <Button
                            key={rating}
                            variant="outline"
                            disabled={busy}
                            onClick={() => void rate(rating)}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <Button onClick={() => setRevealed(true)}>Reveal answer</Button>
                  )}
                </div>
              )}
              {stage === "practice" &&
                (questionIndex < session.questions.length && q ? (
                  <div className={panel}>
                    <p className="text-sm text-muted-foreground">
                      Practice · Question {questionIndex + 1} of {session.questions.length} ·{" "}
                      {q.subject}
                      {q.topic ? ` / ${q.topic}` : ""}
                    </p>
                    <MarkdownContent content={q.question} />
                    <div role="group" aria-label="Answer choices" className="space-y-2">
                      {q.options.map((option, i) => (
                        <div
                          key={i}
                          role="button"
                          tabIndex={checked ? -1 : 0}
                          aria-disabled={checked}
                          aria-pressed={choice === i}
                          onClick={() => {
                            if (!checked) setChoice(i);
                          }}
                          onKeyDown={(e) => {
                            if (!checked && (e.key === "Enter" || e.key === " ")) {
                              e.preventDefault();
                              setChoice(i);
                            }
                          }}
                          className={`cursor-pointer border rounded-xl p-3 ${checked && i === q.correct_options[0] ? "border-green-600 bg-green-500/10" : choice === i ? "border-primary bg-primary/10" : "border-border"}`}
                        >
                          <MarkdownContent content={`${String.fromCharCode(65 + i)}. ${option}`} />
                        </div>
                      ))}
                    </div>
                    {checked ? (
                      <>
                        <p className="font-medium" role="status">
                          {choice === q.correct_options[0]
                            ? "Correct"
                            : `Correct answer: ${String.fromCharCode(65 + q.correct_options[0])}`}
                        </p>
                        <MarkdownContent content={toQuizQuestion(q).explanation} />
                        <Button
                          onClick={() => {
                            setQuestionIndex((i) => i + 1);
                            setChoice(null);
                            setChecked(false);
                          }}
                        >
                          Continue
                        </Button>
                      </>
                    ) : (
                      <Button
                        disabled={choice === null}
                        onClick={() => {
                          setAnswers((a) => [...a, choice!]);
                          setChecked(true);
                        }}
                      >
                        Check answer
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className={panel}>
                    <h2 className="text-xl font-semibold">Practice complete</h2>
                    <p>
                      {results.filter((r) => r.correct).length} of {results.length} correct. Save
                      your results to continue.
                    </p>
                    <Button disabled={busy} onClick={() => void finishPractice()}>
                      {busy ? "Saving…" : "Save practice & continue"}
                    </Button>
                  </div>
                ))}
              {stage === "task" && session.task && (
                <div className={panel}>
                  <p className="text-sm text-muted-foreground">
                    Focus ·{" "}
                    {session.task.date < todayIST() ? "Catch up on your plan" : "From today’s plan"}
                  </p>
                  <h2 className="text-xl font-semibold">{session.task.task}</h2>
                  <p className="text-muted-foreground">
                    Use your remaining time for this task. Mark it complete when you’ve finished, or
                    leave it in your plan for later.
                  </p>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api.updatePlanItem(session.task!.id, true);
                        setTaskDone(true);
                        refresh();
                        advance("task");
                      })
                    }
                  >
                    {busy ? "Saving…" : "Mark task complete"}
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => advance("task")}>
                    Leave task for later
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
      {stage === "summary" && session && (
        <div className={panel}>
          <CheckCircle2 size={36} className="text-primary" />
          <h2 className="text-2xl font-bold">Session complete</h2>
          <p className="text-muted-foreground">
            {Math.floor(elapsed / 60)}m {elapsed % 60}s studied · {session.minutes}-minute budget
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              ["Cards reviewed", `${cardIndex}`],
              [
                "Practice accuracy",
                results.length
                  ? `${Math.round((results.filter((r) => r.correct).length / results.length) * 100)}%`
                  : "—",
              ],
              [
                "Planned task",
                taskDone ? "Completed" : session.task ? "Still in plan" : "None due",
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-muted p-4">
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>
          <h3 className="font-semibold">What moved forward</h3>
          <ul className="space-y-2 text-sm list-disc pl-5">
            {cardIndex > 0 && (
              <li>
                {recalled} of {cardIndex} cards recalled well. Review dates updated for every rated
                card.
              </li>
            )}
            {results.length > 0 && (
              <li>
                {results.filter((r) => r.correct).length} of {results.length} practice questions
                correct. Results saved to quizzes and topic analytics.
              </li>
            )}
            {taskDone && <li>Your planned task is now marked complete.</li>}
          </ul>
          {comparison ? (
            <p className="rounded-xl bg-primary/10 p-4 text-sm">
              On topics with prior results: {comparison.before}% previously → {comparison.after}%
              this session ({comparison.count} questions).{" "}
              {comparison.after > comparison.before
                ? `That’s ${comparison.after - comparison.before} percentage points higher.`
                : "Keep practicing to build consistency."}{" "}
              A small session is a progress signal, not a mastery score.
            </p>
          ) : (
            results.length > 0 && (
              <p className="text-sm text-muted-foreground">
                This session establishes a practice baseline. More attempts will make comparisons
                possible.
              </p>
            )
          )}
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/">Back to dashboard</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/analytics">View analytics</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/review">Open Smart Review</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
