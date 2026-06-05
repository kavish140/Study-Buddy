import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Brain,
  Calendar,
  FileText,
  Clock,
  TrendingUp,
  Zap,
  Target,
  BarChart3,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getExamById } from "@/lib/exam-catalog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — AcePrep" },
      {
        name: "description",
        content:
          "Your AI-powered competitive exam prep dashboard: syllabus progress, quizzes, study plan and notes.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: api.getSubjects });
  const { data: quizzes = [] } = useQuery({ queryKey: ["quizzes"], queryFn: api.getQuizzes });
  const { data: plan = [] } = useQuery({ queryKey: ["plan"], queryFn: api.getPlan });
  const { data: notes = [] } = useQuery({ queryKey: ["notes"], queryFn: api.getNotes });
  const { data: mockTests = [] } = useQuery({ queryKey: ["mockTests"], queryFn: api.getMockTests });
  const { data: profile } = useQuery({ queryKey: ["userProfile"], queryFn: api.getUserProfile });

  const examInfo = profile?.exam_id ? getExamById(profile.exam_id) : null;
  const daysRemaining = profile?.target_date
    ? Math.max(
        0,
        Math.ceil((new Date(profile.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      )
    : null;

  const totalTopics = subjects.reduce((s, x) => s + x.topics.length, 0);
  const doneTopics = subjects.reduce((s, x) => s + x.topics.filter((t) => t.done).length, 0);
  const pct = totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0;
  const avgScore = quizzes.length
    ? Math.round((quizzes.reduce((s, q) => s + (q.score ?? 0), 0) / quizzes.length) * 100) / 100
    : 0;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayItems = plan.filter((p) => p.date === todayKey);

  return (
    <div className="relative min-h-full">
      {/* Hero gradient background */}
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 py-10">
        {/* Hero section */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
            <Zap className="h-3 w-3 text-primary" />
            <span className="text-primary font-medium">AI-Powered Exam Prep</span>
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-heading">
          Welcome to <span className="text-gradient">AcePrep</span>
        </h1>
        <p className="mt-3 text-muted-foreground max-w-xl text-lg">
          Your all-in-one platform to crack competitive exams. Track progress, practice smart, and
          ace your goals.
        </p>

        {/* Exam countdown card */}
        {examInfo && (
          <div className="mt-8 glass-card p-6 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="h-14 w-14 rounded-xl grid place-items-center text-2xl"
                  style={{ backgroundColor: (examInfo.color || "#3b82f6") + "15" }}
                >
                  {examInfo.icon}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Preparing for</div>
                  <div className="font-bold font-heading text-xl">{examInfo.name}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {examInfo.examPattern.totalTimeMinutes} min
                    </span>
                    <span>{examInfo.examPattern.totalQuestions} questions</span>
                    <Link to="/onboarding" className="text-primary hover:underline">
                      Change
                    </Link>
                  </div>
                </div>
              </div>
              {daysRemaining !== null && (
                <div className="text-center sm:text-right px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="text-3xl font-bold font-heading text-gradient">
                    {daysRemaining}
                  </div>
                  <div className="text-xs text-muted-foreground">days left</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-10">
          <StatCard
            label="Syllabus progress"
            value={`${pct}%`}
            hint={`${doneTopics}/${totalTopics} topics`}
            icon={<Target className="h-4 w-4" />}
            accentColor="primary"
          />
          <StatCard
            label="Quizzes taken"
            value={`${quizzes.length}`}
            hint={`avg ${avgScore}/q`}
            icon={<Brain className="h-4 w-4" />}
            accentColor="accent"
          />
          <StatCard
            label="Today's tasks"
            value={`${todayItems.length}`}
            hint="study planner"
            icon={<Calendar className="h-4 w-4" />}
            accentColor="warning"
          />
          <StatCard
            label="Notes saved"
            value={`${notes.length}`}
            hint="flashcard decks"
            icon={<FileText className="h-4 w-4" />}
            accentColor="success"
          />
          <Link to="/analytics" className="contents">
            <StatCard
              label="Accuracy"
              value={`${
                quizzes.length + mockTests.filter((t) => t.status === "completed").length > 0
                  ? Math.round(
                      (quizzes.reduce((s, q) => s + (q.score ?? 0), 0) /
                        Math.max(
                          1,
                          quizzes.reduce((s, q) => s + q.questions.length, 0),
                        )) *
                        100,
                    )
                  : 0
              }%`}
              hint="view analytics"
              icon={<BarChart3 className="h-4 w-4" />}
              accentColor="accent"
            />
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <FeatureCard
            to="/syllabus"
            icon={<BookOpen className="h-5 w-5" />}
            title="Syllabus tracker"
            desc="Paste a syllabus and let AI structure subjects and topics. Mark progress as you go."
            gradient="from-blue-500/20 to-cyan-500/10"
          />
          <FeatureCard
            to="/quiz"
            icon={<Brain className="h-5 w-5" />}
            title="AI quizzer"
            desc="Generate exam-pattern quizzes on any topic in seconds. Get detailed solutions."
            gradient="from-purple-500/20 to-pink-500/10"
          />
          <FeatureCard
            to="/planner"
            icon={<Calendar className="h-5 w-5" />}
            title="Study planner"
            desc="Auto-build a multi-day study schedule tailored to your exam date."
            gradient="from-amber-500/20 to-orange-500/10"
          />
          <FeatureCard
            to="/notes"
            icon={<FileText className="h-5 w-5" />}
            title="Notes & flashcards"
            desc="Summarize any topic into clear notes and drill with flashcard decks."
            gradient="from-emerald-500/20 to-teal-500/10"
          />
        </div>

        {/* Progress bar */}
        {totalTopics > 0 && (
          <div className="mt-8 glass-card p-6 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-primary" />
                Overall progress
              </div>
              <span className="text-sm font-semibold text-gradient">{pct}%</span>
            </div>
            <div className="mt-3 h-2.5 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-primary rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {doneTopics} of {totalTopics} topics complete — keep going!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  accentColor,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accentColor: "primary" | "accent" | "warning" | "success";
}) {
  const colorMap = {
    primary: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
    accent: { bg: "bg-accent/10", text: "text-accent", border: "border-accent/20" },
    warning: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20" },
    success: { bg: "bg-success/10", text: "text-success", border: "border-success/20" },
  };
  const colors = colorMap[accentColor];

  return (
    <div className="glass-card p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted-foreground font-medium">{label}</div>
        <div
          className={`h-8 w-8 rounded-lg ${colors.bg} ${colors.text} grid place-items-center border ${colors.border}`}
        >
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold font-heading">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function FeatureCard({
  to,
  icon,
  title,
  desc,
  gradient,
}: {
  to: "/syllabus" | "/quiz" | "/planner" | "/notes";
  icon: React.ReactNode;
  title: string;
  desc: string;
  gradient: string;
}) {
  return (
    <Link to={to} className="group glass-card p-6 rounded-2xl relative overflow-hidden">
      {/* Gradient hover background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      />

      <div className="relative">
        <div className="h-11 w-11 rounded-xl bg-gradient-primary grid place-items-center text-white mb-4 group-hover:shadow-glow-sm transition-shadow duration-300">
          {icon}
        </div>
        <div className="font-semibold font-heading text-lg">{title}</div>
        <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{desc}</div>
      </div>
    </Link>
  );
}
