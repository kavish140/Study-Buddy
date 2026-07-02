import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Brain,
  Calendar,
  FileText,
  TrendingUp,
  Zap,
  Target,
  BarChart3,
  FlipHorizontal2,
  Sparkles,
  Flame,
  ArrowRight,
  GraduationCap,
  Trophy,
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getExamById } from "@/lib/exam-catalog";
import { xpForNextLevel } from "@/lib/storage";
import { useTutorial } from "@/components/TutorialProvider";
import { useEffect } from "react";

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
  const { triggerPageTour } = useTutorial();

  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: api.getSubjects });
  const { data: quizzes = [] } = useQuery({ queryKey: ["quizzes"], queryFn: api.getQuizzes });
  const { data: plan = [] } = useQuery({ queryKey: ["plan"], queryFn: api.getPlan });
  const { data: notes = [] } = useQuery({ queryKey: ["notes"], queryFn: api.getNotes });
  const { data: mockTests = [] } = useQuery({ queryKey: ["mockTests"], queryFn: api.getMockTests });
  const { data: profile } = useQuery({ queryKey: ["userProfile"], queryFn: api.getUserProfile });
  const { data: userStats } = useQuery({ queryKey: ["userStats"], queryFn: api.getUserStats });
  const { data: dueCards = [] } = useQuery({
    queryKey: ["reviewCards"],
    queryFn: api.getDueReviewCards,
  });

  // Auto-trigger global tour on dashboard for new users
  useEffect(() => {
    if (profile?.onboarding_completed) {
      triggerPageTour("global");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.onboarding_completed]);

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
  const todayDone = todayItems.filter((p) => p.done).length;

  const xpInfo = userStats ? xpForNextLevel(userStats.xp) : null;

  // Determine "Today's Focus" message
  const todayFocus = (() => {
    if (dueCards.length > 0)
      return {
        msg: `You have ${dueCards.length} flashcard${dueCards.length > 1 ? "s" : ""} due for review today.`,
        action: "Review Now",
        to: "/review" as const,
        color: "from-violet-500/20 to-purple-500/10",
        icon: FlipHorizontal2,
        iconColor: "text-violet-400",
      };
    if (todayItems.length > 0)
      return {
        msg: `${todayDone}/${todayItems.length} study tasks done today. Keep the momentum going!`,
        action: "View Plan",
        to: "/planner" as const,
        color: "from-amber-500/20 to-orange-500/10",
        icon: Calendar,
        iconColor: "text-amber-400",
      };
    if (quizzes.length < 3)
      return {
        msg: "Start your first quiz to test your knowledge and build confidence.",
        action: "Take a Quiz",
        to: "/quiz" as const,
        color: "from-blue-500/20 to-cyan-500/10",
        icon: Brain,
        iconColor: "text-blue-400",
      };
    return {
      msg: `Great progress at ${pct}% syllabus completion. Ask your AI tutor if you're stuck on anything.`,
      action: "Ask AI Tutor",
      to: "/chat" as const,
      color: "from-emerald-500/20 to-teal-500/10",
      icon: Sparkles,
      iconColor: "text-emerald-400",
    };
  })();

  const FocusIcon = todayFocus.icon;

  return (
    <div className="relative min-h-full">
      {/* Hero gradient background */}
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-5 py-8 space-y-7" data-tour="tour-dashboard">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              <Zap className="h-3 w-3 text-primary" />
              <span className="text-xs text-primary font-medium">AI-Powered Exam Prep</span>
            </div>
            {examInfo && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium"
                style={{
                  backgroundColor: (examInfo.color || "#3b82f6") + "15",
                  borderColor: (examInfo.color || "#3b82f6") + "30",
                  color: examInfo.color || "#3b82f6",
                }}
              >
                <span>{examInfo.icon}</span>
                {examInfo.name}
              </div>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">
            {userStats ? `Welcome back! 👋` : "Welcome to "}
            {!userStats && <span className="text-gradient">AcePrep</span>}
          </h1>
          <p className="mt-1.5 text-muted-foreground max-w-lg">
            {examInfo
              ? `Preparing for ${examInfo.name}${daysRemaining !== null ? ` — ${daysRemaining} days to go.` : "."}`
              : "Your all-in-one platform to crack competitive exams."}
          </p>
        </div>

        {/* ── Today's Focus card ──────────────────────────────────────── */}
        <div
          className={`glass-card rounded-2xl p-5 bg-gradient-to-br ${todayFocus.color} border-primary/10`}
          data-tour="tour-today-focus"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`h-10 w-10 rounded-xl glass-subtle grid place-items-center shrink-0 ${todayFocus.iconColor}`}
              >
                <FocusIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Today's Focus
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">{todayFocus.msg}</p>
              </div>
            </div>
            <Link
              to={todayFocus.to}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              {todayFocus.action}
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* ── Stats row ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Syllabus"
            value={`${pct}%`}
            hint={`${doneTopics}/${totalTopics} topics`}
            icon={<Target className="h-4 w-4" />}
            ring={pct}
            accentColor="primary"
          />
          <StatCard
            label="Quizzes"
            value={`${quizzes.length}`}
            hint={quizzes.length > 0 ? `avg ${avgScore}/q` : "None yet"}
            icon={<Brain className="h-4 w-4" />}
            accentColor="accent"
          />
          <StatCard
            label="Due Cards"
            value={`${dueCards.length}`}
            hint={dueCards.length > 0 ? "Review today!" : "All caught up"}
            icon={<FlipHorizontal2 className="h-4 w-4" />}
            accentColor={dueCards.length > 0 ? "warning" : "success"}
            linkTo="/review"
          />
          <StatCard
            label="XP"
            value={userStats ? `${userStats.xp}` : "—"}
            hint={userStats ? `Level ${userStats.level}` : "Start earning"}
            icon={<Zap className="h-4 w-4" />}
            accentColor="warning"
          />
        </div>

        {/* ── XP progress bar ─────────────────────────────────────────── */}
        {xpInfo && userStats && (
          <div className="glass-card p-4 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium">Level {userStats.level} Progress</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {userStats.current_streak > 0 && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <Flame size={12} />
                    {userStats.current_streak}d streak
                  </span>
                )}
                <span className="text-gradient font-semibold">{xpInfo.pct}%</span>
              </div>
            </div>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${xpInfo.pct}%` }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {xpInfo.current}/{xpInfo.needed} XP to Level {userStats.level + 1}
            </div>
          </div>
        )}

        {/* ── Quick action cards ──────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickAction
              to="/quiz"
              icon={<Brain className="h-5 w-5" />}
              label="Start Quiz"
              hint="AI exam questions"
              gradient="from-blue-500 to-cyan-500"
              glow="shadow-[0_4px_20px_rgba(59,130,246,0.3)]"
            />
            <QuickAction
              to="/review"
              icon={<FlipHorizontal2 className="h-5 w-5" />}
              label="Review Cards"
              hint={dueCards.length > 0 ? `${dueCards.length} due now` : "All reviewed!"}
              gradient="from-violet-500 to-purple-500"
              glow="shadow-[0_4px_20px_rgba(139,92,246,0.3)]"
            />
            <QuickAction
              to="/chat"
              icon={<Sparkles className="h-5 w-5" />}
              label="Ask AI Tutor"
              hint="Any question, anytime"
              gradient="from-emerald-500 to-teal-500"
              glow="shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
            />
            <QuickAction
              to="/focus"
              icon={<Flame className="h-5 w-5" />}
              label="Focus Session"
              hint="Pomodoro timer"
              gradient="from-orange-500 to-amber-500"
              glow="shadow-[0_4px_20px_rgba(245,158,11,0.3)]"
            />
          </div>
        </div>

        {/* ── Exam countdown + feature cards ─────────────────────────── */}
        {examInfo && daysRemaining !== null && (
          <div className="glass-card p-5 rounded-2xl flex items-center gap-5">
            <div
              className="h-14 w-14 rounded-xl grid place-items-center text-2xl shrink-0"
              style={{ backgroundColor: (examInfo.color || "#3b82f6") + "15" }}
            >
              {examInfo.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">Preparing for</div>
              <div className="font-bold font-heading text-lg">{examInfo.name}</div>
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
            <div className="text-center px-5 py-3 rounded-xl bg-primary/5 border border-primary/10 shrink-0">
              <div className="text-3xl font-bold font-heading text-gradient">{daysRemaining}</div>
              <div className="text-[11px] text-muted-foreground">days left</div>
            </div>
          </div>
        )}

        {/* ── Feature overview cards ──────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Features
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            <FeatureCard
              to="/syllabus"
              icon={<BookOpen className="h-5 w-5" />}
              title="Syllabus Tracker"
              desc="Paste a syllabus and let AI structure subjects and topics. Mark progress as you go."
              badge={totalTopics > 0 ? `${pct}%` : undefined}
              gradient="from-blue-500/20 to-cyan-500/10"
            />
            <FeatureCard
              to="/planner"
              icon={<Calendar className="h-5 w-5" />}
              title="Study Planner"
              desc="Auto-build a multi-day study schedule tailored to your exam date and remaining topics."
              badge={todayItems.length > 0 ? `${todayDone}/${todayItems.length} today` : undefined}
              gradient="from-amber-500/20 to-orange-500/10"
            />
            <FeatureCard
              to="/analytics"
              icon={<BarChart3 className="h-5 w-5" />}
              title="Analytics"
              desc="See your accuracy trend, weak subjects, and study time to optimise your preparation."
              gradient="from-purple-500/20 to-pink-500/10"
            />
            <FeatureCard
              to="/notes"
              icon={<FileText className="h-5 w-5" />}
              title="Notes & Flashcards"
              desc="Summarise any topic into clear notes and auto-generate a flashcard deck."
              badge={notes.length > 0 ? `${notes.length} notes` : undefined}
              gradient="from-emerald-500/20 to-teal-500/10"
            />
          </div>
        </div>

        {/* ── Overall progress bar ────────────────────────────────────── */}
        {totalTopics > 0 && (
          <div className="glass-card p-5 rounded-2xl" data-tour="tour-overall-progress">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-primary" />
                Overall Syllabus Progress
              </div>
              <span className="text-sm font-semibold text-gradient">{pct}%</span>
            </div>
            <div className="h-2.5 bg-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-primary rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                {doneTopics} of {totalTopics} topics complete
              </span>
              {pct < 100 && (
                <Link
                  to="/syllabus"
                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                >
                  Continue <ArrowRight size={11} />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── Empty state for new users ───────────────────────────────── */}
        {totalTopics === 0 && quizzes.length === 0 && (
          <div className="glass-card p-8 rounded-2xl text-center border-dashed border-2 border-primary/10">
            <GraduationCap className="h-12 w-12 text-primary/40 mx-auto mb-4" />
            <h3 className="font-semibold font-heading text-lg mb-2">Ready to start?</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Begin by adding your syllabus so AI can structure your subjects and topics. Then
              generate your first quiz!
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/syllabus"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <BookOpen size={15} />
                Set up Syllabus
              </Link>
              <Link
                to="/quiz"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-sidebar-accent transition-colors"
              >
                <Brain size={15} />
                Try a Quiz
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** ── Stat Card ─────────────────────────────────────────────────────────── */
function StatCard({
  label,
  value,
  hint,
  icon,
  accentColor,
  ring,
  linkTo,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accentColor: "primary" | "accent" | "warning" | "success";
  ring?: number;
  linkTo?: string;
}) {
  const colorMap = {
    primary: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
    accent: { bg: "bg-accent/10", text: "text-accent", border: "border-accent/20" },
    warning: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20" },
    success: { bg: "bg-success/10", text: "text-success", border: "border-success/20" },
  };
  const c = colorMap[accentColor];

  const content = (
    <div className="glass-card p-4 rounded-2xl h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </div>
        <div
          className={`h-7 w-7 rounded-lg ${c.bg} ${c.text} grid place-items-center border ${c.border}`}
        >
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold font-heading">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
      {ring !== undefined && ring > 0 && (
        <div className="mt-2 h-1 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-primary rounded-full transition-all duration-700"
            style={{ width: `${ring}%` }}
          />
        </div>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo as "/review"} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

/** ── Quick Action Card ──────────────────────────────────────────────────── */
function QuickAction({
  to,
  icon,
  label,
  hint,
  gradient,
  glow,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  gradient: string;
  glow: string;
}) {
  return (
    <Link
      to={to as "/quiz"}
      className={`group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-br ${gradient} border border-white/5 text-white ${glow} transition-all duration-200 hover:scale-[1.03] hover:brightness-110`}
    >
      <div className="h-10 w-10 rounded-xl bg-white/15 grid place-items-center group-hover:bg-white/25 transition-colors">
        {icon}
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-[11px] text-white/70">{hint}</div>
      </div>
    </Link>
  );
}

/** ── Feature Card ───────────────────────────────────────────────────────── */
function FeatureCard({
  to,
  icon,
  title,
  desc,
  gradient,
  badge,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  gradient: string;
  badge?: string;
}) {
  return (
    <Link
      to={to as "/syllabus"}
      className="group glass-card p-5 rounded-2xl relative overflow-hidden"
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      />
      <div className="relative flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center text-white shrink-0 group-hover:shadow-glow-sm transition-shadow duration-300">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-semibold font-heading">{title}</div>
            {badge && (
              <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold border border-primary/20">
                {badge}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
      </div>
    </Link>
  );
}
