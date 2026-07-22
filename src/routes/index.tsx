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
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getExamById } from "@/lib/exam-catalog";
import { daysUntilIST, todayIST } from "@/lib/date-utils";
import { getTier, TIERS } from "@/lib/storage";

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
  const { data: userStats } = useQuery({ queryKey: ["userStats"], queryFn: api.getUserStats });
  const { data: dueCards = [] } = useQuery({
    queryKey: ["reviewCards"],
    queryFn: api.getDueReviewCards,
  });

  const examInfo = profile?.exam_id ? getExamById(profile.exam_id) : null;
  const daysRemaining = daysUntilIST(profile?.target_date);

  const totalTopics = subjects.reduce((s, x) => s + x.topics.length, 0);
  const doneTopics = subjects.reduce((s, x) => s + x.topics.filter((t) => t.done).length, 0);
  const pct = totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0;
  const avgScore = quizzes.length
    ? Math.round((quizzes.reduce((s, q) => s + (q.score ?? 0), 0) / quizzes.length) * 100) / 100
    : 0;

  const todayKey = todayIST();
  const todayItems = plan.filter((p) => p.date === todayKey);
  const todayDone = todayItems.filter((p) => p.done).length;

  const tierInfo = userStats ? getTier(userStats.xp) : null;

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
    <div className="relative min-h-full" style={{ background: "var(--background)" }}>
      {/* Subtle hero tint */}
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
          className="card-light rounded-2xl p-5 relative overflow-hidden"
          data-tour="tour-today-focus"
          style={{ borderLeft: "4px solid var(--primary)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${todayFocus.iconColor}`}
                style={{ background: "var(--accent)" }}
              >
                <FocusIcon className="h-5 w-5" />
              </div>
              <div>
                <div
                  className="text-xs font-semibold uppercase tracking-wide mb-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Today's Focus
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
                  {todayFocus.msg}
                </p>
              </div>
            </div>
            <Link
              to={todayFocus.to}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-opacity"
              style={{ background: "var(--gradient-primary)" }}
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
            hint={
              tierInfo
                ? `${tierInfo.tier.emoji} ${tierInfo.tier.name}`
                : "Start earning"
            }
            icon={<Zap className="h-4 w-4" />}
            accentColor="warning"
          />
        </div>

        {/* ── Rank Tier card ───────────────────────────────────────────── */}
        {tierInfo && userStats && (
          <div
            className="card-light p-5 rounded-2xl relative overflow-hidden"
            data-tour="tour-rank-tier"
            style={{ borderLeft: `4px solid ${tierInfo.tier.color}` }}
          >
            {/* Decorative background glow */}
            <div
              className="absolute -right-6 -top-6 h-24 w-24 rounded-full pointer-events-none"
              style={{ background: tierInfo.tier.bg, filter: "blur(20px)" }}
            />

            <div className="relative flex items-center justify-between gap-4">
              {/* Left: tier badge + info */}
              <div className="flex items-center gap-3">
                <div
                  className="h-14 w-14 rounded-2xl grid place-items-center text-3xl shrink-0 shadow-glow-sm"
                  style={{ background: tierInfo.tier.bg, border: `2px solid ${tierInfo.tier.color}40` }}
                >
                  {tierInfo.tier.emoji}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: tierInfo.tier.color }}>
                    Current Rank
                  </div>
                  <div className="text-xl font-bold font-heading" style={{ color: tierInfo.tier.color }}>
                    {tierInfo.tier.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    <span>{userStats.xp} XP total</span>
                    {userStats.current_streak > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <Flame size={11} />{userStats.current_streak}d streak
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: next tier preview */}
              {tierInfo.nextTier && (
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground mb-0.5">Next</div>
                  <div className="text-base font-bold">
                    {tierInfo.nextTier.emoji} {tierInfo.nextTier.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tierInfo.tierRangeXP - tierInfo.currentTierXP} XP away
                  </div>
                </div>
              )}
              {!tierInfo.nextTier && (
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold" style={{ color: tierInfo.tier.color }}>Max Rank!</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Legendary</div>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {tierInfo.nextTier && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span>{tierInfo.tier.name}</span>
                  <span className="font-medium">{tierInfo.pct}%</span>
                  <span>{tierInfo.nextTier.name}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                  <div
                    className="h-full rounded-full progress-fill transition-all duration-700"
                    style={{
                      "--pct": `${tierInfo.pct}%`,
                      background: `linear-gradient(90deg, ${tierInfo.tier.color}, ${tierInfo.nextTier.color})`,
                    } as React.CSSProperties}
                  />
                </div>
                <div className="text-[11px] mt-1 text-right" style={{ color: "var(--muted-foreground)" }}>
                  {tierInfo.currentTierXP} / {tierInfo.tierRangeXP} XP
                </div>
              </div>
            )}

            {/* All tiers mini-map */}
            {(() => {
              const currentTierIdx = TIERS.findIndex((t) => t.name === tierInfo.tier.name);
              return (
                <div className="mt-3 flex items-center gap-1">
                  {TIERS.map((t, i) => {
                    const reached = i <= currentTierIdx;
                    const isCurrent = i === currentTierIdx;
                    return (
                      <div
                        key={t.name}
                        className="flex-1 text-center rounded py-0.5 transition-all"
                        title={t.name}
                        style={{
                          opacity: reached ? 1 : 0.25,
                          fontSize: isCurrent ? "1rem" : "0.65rem",
                          transform: isCurrent ? "scale(1.2)" : "scale(1)",
                        }}
                      >
                        {t.emoji}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Leaderboard link */}
            <Link
              to="/leaderboard"
              className="mt-3 text-xs flex items-center justify-end gap-1 hover:underline"
              style={{ color: tierInfo.tier.color }}
            >
              View Leaderboard <ArrowRight size={11} />
            </Link>
          </div>
        )}

        {/* ── Quick action cards ──────────────────────────────────────── */}
        <div>
          <h2
            className="text-sm font-bold uppercase tracking-widest mb-3"
            style={{ color: "var(--muted-foreground)" }}
          >
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickAction
              to="/quiz"
              icon={<Brain className="h-5 w-5" />}
              label="Start Quiz"
              hint="AI exam questions"
              colorVar="--feat-quiz"
              bgVar="--feat-quiz-bg"
            />
            <QuickAction
              to="/review"
              icon={<FlipHorizontal2 className="h-5 w-5" />}
              label="Review Cards"
              hint={dueCards.length > 0 ? `${dueCards.length} due now` : "All reviewed!"}
              colorVar="--feat-review"
              bgVar="--feat-review-bg"
            />
            <QuickAction
              to="/chat"
              icon={<Sparkles className="h-5 w-5" />}
              label="Ask AI Tutor"
              hint="Any question, anytime"
              colorVar="--feat-chat"
              bgVar="--feat-chat-bg"
            />
            <QuickAction
              to="/focus"
              icon={<Flame className="h-5 w-5" />}
              label="Focus Session"
              hint="Pomodoro timer"
              colorVar="--feat-focus"
              bgVar="--feat-focus-bg"
            />
          </div>
        </div>

        {/* ── Exam countdown ───────────────────────────────────────────── */}
        {examInfo && daysRemaining !== null && (
          <div className="card-light p-5 rounded-2xl flex items-center gap-5">
            <div
              className="h-14 w-14 rounded-xl grid place-items-center text-2xl shrink-0"
              style={{ backgroundColor: (examInfo.color || "#2563eb") + "15" }}
            >
              {examInfo.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Preparing for
              </div>
              <div className="font-bold text-lg">{examInfo.name}</div>
              <div
                className="flex items-center gap-3 mt-1 text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {examInfo.examPattern.totalTimeMinutes} min
                </span>
                <span>{examInfo.examPattern.totalQuestions} questions</span>
                <Link
                  to="/onboarding"
                  className="hover:underline"
                  style={{ color: "var(--primary)" }}
                >
                  Change
                </Link>
              </div>
            </div>
            <div
              className="text-center px-5 py-3 rounded-xl shrink-0"
              style={{ background: "var(--accent)", border: "1px solid var(--border)" }}
            >
              <div className="text-3xl font-bold text-gradient">{daysRemaining}</div>
              <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                days left
              </div>
            </div>
          </div>
        )}

        {/* ── Feature overview cards ──────────────────────────────────── */}
        <div>
          <h2
            className="text-sm font-bold uppercase tracking-widest mb-3"
            style={{ color: "var(--muted-foreground)" }}
          >
            Features
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            <FeatureCard
              to="/syllabus"
              icon={<BookOpen className="h-5 w-5" />}
              title="Syllabus Tracker"
              desc="Paste a syllabus and let AI structure subjects and topics. Mark progress as you go."
              badge={totalTopics > 0 ? `${pct}%` : undefined}
              colorVar="--feat-syllabus"
              bgVar="--feat-syllabus-bg"
            />
            <FeatureCard
              to="/planner"
              icon={<Calendar className="h-5 w-5" />}
              title="Study Planner"
              desc="Auto-build a multi-day study schedule tailored to your exam date and remaining topics."
              badge={todayItems.length > 0 ? `${todayDone}/${todayItems.length} today` : undefined}
              colorVar="--feat-planner"
              bgVar="--feat-planner-bg"
            />
            <FeatureCard
              to="/analytics"
              icon={<BarChart3 className="h-5 w-5" />}
              title="Analytics"
              desc="See your accuracy trend, weak subjects, and study time to optimise your preparation."
              colorVar="--feat-analytics"
              bgVar="--feat-analytics-bg"
            />
            <FeatureCard
              to="/notes"
              icon={<FileText className="h-5 w-5" />}
              title="Notes & Flashcards"
              desc="Summarise any topic into clear notes and auto-generate a flashcard deck."
              badge={notes.length > 0 ? `${notes.length} notes` : undefined}
              colorVar="--feat-notes"
              bgVar="--feat-notes-bg"
            />
          </div>
        </div>

        {/* ── Overall progress bar ────────────────────────────────────── */}
        {totalTopics > 0 && (
          <div className="card-light p-5 rounded-2xl" data-tour="tour-overall-progress">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4" style={{ color: "var(--primary)" }} />
                Overall Syllabus Progress
              </div>
              <span className="text-sm font-bold text-gradient">{pct}%</span>
            </div>
            <div
              className="h-2.5 rounded-full overflow-hidden"
              style={{ background: "var(--muted)" }}
            >
              <div
                className="h-full rounded-full progress-fill"
                style={
                  {
                    "--pct": `${pct}%`,
                    background: "var(--gradient-primary)",
                  } as React.CSSProperties
                }
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {doneTopics} of {totalTopics} topics complete
              </span>
              {pct < 100 && (
                <Link
                  to="/syllabus"
                  className="text-xs hover:underline flex items-center gap-0.5"
                  style={{ color: "var(--primary)" }}
                >
                  Continue <ArrowRight size={11} />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── Empty state for new users ───────────────────────────────── */}
        {totalTopics === 0 && quizzes.length === 0 && (
          <div
            className="card-light p-8 rounded-2xl text-center"
            style={{ border: "2px dashed var(--border)" }}
          >
            <div
              className="h-14 w-14 rounded-2xl mx-auto mb-4 grid place-items-center"
              style={{ background: "var(--accent)" }}
            >
              <GraduationCap className="h-7 w-7" style={{ color: "var(--primary)" }} />
            </div>
            <h3 className="font-bold text-lg mb-2">Ready to start?</h3>
            <p
              className="text-sm mb-6 max-w-sm mx-auto"
              style={{ color: "var(--muted-foreground)" }}
            >
              Begin by adding your syllabus so AI can structure your subjects and topics. Then
              generate your first quiz!
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/syllabus"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                style={{ background: "var(--gradient-primary)" }}
              >
                <BookOpen size={15} />
                Set up Syllabus
              </Link>
              <Link
                to="/quiz"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-80"
                style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
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
  const colorStyle = {
    primary: { color: "var(--primary)", bg: "var(--accent)" },
    accent: { color: "var(--accent)", bg: "rgba(6,182,212,0.08)" },
    warning: { color: "var(--warning)", bg: "rgba(245,158,11,0.1)" },
    success: { color: "var(--success)", bg: "rgba(16,185,129,0.1)" },
  };
  const cs = colorStyle[accentColor];

  const content = (
    <div className="card-light p-4 rounded-2xl h-full">
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--muted-foreground)" }}
        >
          {label}
        </div>
        <div
          className="h-8 w-8 rounded-lg grid place-items-center"
          style={{ background: cs.bg, color: cs.color }}
        >
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
        {hint}
      </div>
      {ring !== undefined && ring > 0 && (
        <div
          className="mt-2 h-1 rounded-full overflow-hidden"
          style={{ background: "var(--muted)" }}
        >
          <div
            className="h-full rounded-full progress-fill"
            style={
              {
                "--pct": `${ring}%`,
                background: "var(--gradient-primary)",
              } as React.CSSProperties
            }
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
  colorVar,
  bgVar,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  colorVar: string;
  bgVar: string;
}) {
  return (
    <Link
      to={to as "/quiz"}
      className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all duration-200 hover:scale-[1.03] card-light"
      style={{ borderTopColor: `var(${colorVar})`, borderTopWidth: "3px" }}
    >
      <div
        className="h-10 w-10 rounded-xl grid place-items-center transition-transform group-hover:scale-110"
        style={{ background: `var(${bgVar})`, color: `var(${colorVar})` }}
      >
        {icon}
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          {hint}
        </div>
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
  colorVar,
  bgVar,
  badge,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  colorVar: string;
  bgVar: string;
  badge?: string;
}) {
  return (
    <Link
      to={to as "/syllabus"}
      className="group card-light p-5 rounded-2xl relative overflow-hidden"
    >
      <div className="flex items-start gap-3">
        <div
          className="h-10 w-10 rounded-xl grid place-items-center shrink-0 transition-transform group-hover:scale-110"
          style={{ background: `var(${bgVar})`, color: `var(${colorVar})` }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-semibold">{title}</div>
            {badge && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: `var(${bgVar})`, color: `var(${colorVar})` }}
              >
                {badge}
              </span>
            )}
          </div>
          <div
            className="text-sm mt-1 leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            {desc}
          </div>
        </div>
        <ArrowRight
          className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5"
          style={{ color: `var(${colorVar})` }}
        />
      </div>
    </Link>
  );
}
