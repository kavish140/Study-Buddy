import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Brain, Calendar, FileText, Sparkles, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — StudyForge" },
      { name: "description", content: "Your AI-powered study dashboard: syllabus progress, quizzes, plan and notes." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: api.getSubjects });
  const { data: quizzes = [] } = useQuery({ queryKey: ["quizzes"], queryFn: api.getQuizzes });
  const { data: plan = [] } = useQuery({ queryKey: ["plan"], queryFn: api.getPlan });
  const { data: notes = [] } = useQuery({ queryKey: ["notes"], queryFn: api.getNotes });
  const mounted = true;

  const totalTopics = subjects.reduce((s, x) => s + x.topics.length, 0);
  const doneTopics = subjects.reduce((s, x) => s + x.topics.filter((t) => t.done).length, 0);
  const pct = totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0;
  const avgScore = quizzes.length
    ? Math.round(
        (quizzes.reduce((s, q) => s + (q.score ?? 0), 0) / quizzes.length) * 100,
      ) / 100
    : 0;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayItems = plan.filter((p) => p.date === todayKey);

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI study companion
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          Welcome back to <span className="text-gradient">StudyForge</span>
        </h1>
        <p className="mt-3 text-muted-foreground max-w-xl">
          Track your syllabus, generate quizzes on demand, build a plan that fits your week,
          and let AI summarize anything you need to learn.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
          <Stat label="Syllabus progress" value={mounted ? `${pct}%` : "—"} hint={`${doneTopics}/${totalTopics} topics`} />
          <Stat label="Quizzes taken" value={mounted ? `${quizzes.length}` : "—"} hint={`avg ${avgScore}/q`} />
          <Stat label="Today's tasks" value={mounted ? `${todayItems.length}` : "—"} hint="study planner" />
          <Stat label="Notes saved" value={mounted ? `${notes.length}` : "—"} hint="flashcard decks" />
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <FeatureCard
            to="/syllabus"
            icon={<BookOpen className="h-5 w-5" />}
            title="Syllabus tracker"
            desc="Paste a syllabus and let AI structure subjects and topics. Mark progress as you go."
          />
          <FeatureCard
            to="/quiz"
            icon={<Brain className="h-5 w-5" />}
            title="AI quizzer"
            desc="Generate a quiz on any topic in seconds. Get instant explanations."
          />
          <FeatureCard
            to="/planner"
            icon={<Calendar className="h-5 w-5" />}
            title="Study planner"
            desc="Auto-build a multi-day study schedule from your topics."
          />
          <FeatureCard
            to="/notes"
            icon={<FileText className="h-5 w-5" />}
            title="Notes & flashcards"
            desc="Summarize any topic into clear notes and review flashcards."
          />
        </div>

        {mounted && totalTopics > 0 && (
          <div className="mt-8 p-5 rounded-xl bg-card border border-border shadow-elegant">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-primary" /> Overall progress
            </div>
            <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{doneTopics} of {totalTopics} topics complete</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function FeatureCard({
  to,
  icon,
  title,
  desc,
}: {
  to: "/syllabus" | "/quiz" | "/planner" | "/notes";
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group p-5 rounded-xl bg-card border border-border hover:border-primary/50 transition-all hover:shadow-elegant"
    >
      <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center text-primary-foreground mb-3 group-hover:shadow-glow transition-shadow">
        {icon}
      </div>
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{desc}</div>
    </Link>
  );
}
