import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getExamById } from "@/lib/exam-catalog";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Brain,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import type { SavedQuiz, MockTest, PerformanceLog } from "@/lib/storage";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — AcePrep" },
      {
        name: "description",
        content: "Track your performance, identify weak areas, and monitor your progress.",
      },
    ],
  }),
  component: AnalyticsPage,
});

/* ─── helpers ─── */
function computeQuizTrend(quizzes: SavedQuiz[], mockTests: MockTest[]) {
  const entries: { date: string; score: number; type: string }[] = [];

  quizzes.forEach((q) => {
    if (q.score === undefined || q.score === null) return;
    const total = q.questions.length;
    if (!total) return;
    const pct = Math.round((q.score / total) * 100);
    entries.push({
      date: new Date(q.createdAt).toISOString().slice(0, 10),
      score: pct,
      type: "quiz",
    });
  });

  mockTests
    .filter((t) => t.status === "completed" && t.total_marks)
    .forEach((t) => {
      const pct = Math.round(((t.score ?? 0) / t.total_marks!) * 100);
      entries.push({
        date: (t.created_at ?? new Date().toISOString()).slice(0, 10),
        score: pct,
        type: "mock",
      });
    });

  entries.sort((a, b) => a.date.localeCompare(b.date));

  // Group by date, take average
  const grouped = new Map<string, number[]>();
  entries.forEach((e) => {
    const arr = grouped.get(e.date) || [];
    arr.push(e.score);
    grouped.set(e.date, arr);
  });

  return Array.from(grouped.entries()).map(([date, scores]) => ({
    date: new Date(date + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  }));
}

function computeTopicMastery(
  quizzes: SavedQuiz[],
  mockTests: MockTest[],
  perfLogs: PerformanceLog[],
) {
  const topicMap = new Map<
    string,
    { subject: string; topic: string; correct: number; total: number }
  >();

  // From performance logs (primary source)
  perfLogs.forEach((log) => {
    const key = `${log.subject}::${log.topic}`;
    topicMap.set(key, {
      subject: log.subject,
      topic: log.topic,
      correct: log.correct_count,
      total: log.question_count,
    });
  });

  // From quizzes (topic-level)
  quizzes.forEach((q) => {
    if (q.score === undefined || q.score === null) return;
    const key = `General::${q.topic}`;
    const existing = topicMap.get(key) || {
      subject: "General",
      topic: q.topic,
      correct: 0,
      total: 0,
    };
    existing.correct += q.score;
    existing.total += q.questions.length;
    topicMap.set(key, existing);
  });

  // From mock tests (section-level)
  mockTests
    .filter((t) => t.status === "completed")
    .forEach((t) => {
      t.sections.forEach((section) => {
        section.questions.forEach((q) => {
          const key = `${section.name}::${q.topic}`;
          const existing = topicMap.get(key) || {
            subject: section.name,
            topic: q.topic,
            correct: 0,
            total: 0,
          };
          existing.total += 1;
          if (t.answers[q.id] === q.answerIndex) existing.correct += 1;
          topicMap.set(key, existing);
        });
      });
    });

  return Array.from(topicMap.values())
    .filter((t) => t.total > 0)
    .map((t) => ({ ...t, accuracy: Math.round((t.correct / t.total) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

function AnalyticsPage() {
  const { data: quizzes = [] } = useQuery({ queryKey: ["quizzes"], queryFn: api.getQuizzes });
  const { data: mockTests = [] } = useQuery({ queryKey: ["mockTests"], queryFn: api.getMockTests });
  const { data: perfLogs = [] } = useQuery({
    queryKey: ["perfLogs"],
    queryFn: api.getPerformanceLogs,
  });
  const { data: profile } = useQuery({ queryKey: ["userProfile"], queryFn: api.getUserProfile });

  const examInfo = profile?.exam_id ? getExamById(profile.exam_id) : null;
  const trendData = computeQuizTrend(quizzes, mockTests);
  const topicData = computeTopicMastery(quizzes, mockTests, perfLogs);
  const weakTopics = topicData.filter((t) => t.accuracy < 50).slice(0, 5);
  const strongTopics = topicData
    .filter((t) => t.accuracy >= 70)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5);

  // Overall stats
  const completedMocks = mockTests.filter((t) => t.status === "completed");
  const totalQuizzes = quizzes.length;
  const totalMocks = completedMocks.length;
  const totalQuestions =
    quizzes.reduce((s, q) => s + q.questions.length, 0) +
    completedMocks.reduce(
      (s, t) => s + t.sections.reduce((ss, sec) => ss + sec.questions.length, 0),
      0,
    );

  const overallAccuracy = topicData.length
    ? Math.round(
        (topicData.reduce((s, t) => s + t.correct, 0) /
          Math.max(
            1,
            topicData.reduce((s, t) => s + t.total, 0),
          )) *
          100,
      )
    : 0;

  const recentScores = trendData.slice(-5);
  const trend =
    recentScores.length >= 2
      ? recentScores[recentScores.length - 1].score - recentScores[0].score
      : 0;

  // Group topics by subject for heatmap
  const subjectGroups = new Map<string, typeof topicData>();
  topicData.forEach((t) => {
    const arr = subjectGroups.get(t.subject) || [];
    arr.push(t);
    subjectGroups.set(t.subject, arr);
  });

  const hasData = totalQuizzes > 0 || totalMocks > 0;

  return (
    <div className="relative min-h-full">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight font-heading">
          <span className="text-gradient">Analytics</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          {examInfo
            ? `Performance overview for ${examInfo.name}`
            : "Track your exam prep performance"}
        </p>

        {!hasData ? (
          <div className="glass-card p-12 rounded-2xl mt-8 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h2 className="font-semibold font-heading text-lg mb-2">No data yet</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Take quizzes and mock tests to see your performance analytics here. Your scores, topic
              mastery, and improvement trends will appear automatically.
            </p>
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              <StatCard
                label="Overall accuracy"
                value={`${overallAccuracy}%`}
                icon={<Target className="h-4 w-4" />}
                accent={
                  overallAccuracy >= 70
                    ? "success"
                    : overallAccuracy >= 40
                      ? "warning"
                      : "destructive"
                }
              />
              <StatCard
                label="Questions practiced"
                value={`${totalQuestions}`}
                icon={<Brain className="h-4 w-4" />}
                accent="primary"
              />
              <StatCard
                label="Quizzes / Mocks"
                value={`${totalQuizzes} / ${totalMocks}`}
                icon={<Zap className="h-4 w-4" />}
                accent="accent"
              />
              <StatCard
                label="Score trend"
                value={`${trend >= 0 ? "+" : ""}${trend}%`}
                icon={
                  trend >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )
                }
                accent={trend >= 0 ? "success" : "destructive"}
              />
            </div>

            {/* Score trend chart */}
            {trendData.length >= 2 && (
              <div className="glass-card p-6 rounded-2xl mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Score Trend</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.08)" />
                      <XAxis
                        dataKey="date"
                        stroke="#7b8baa"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke="#7b8baa"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(15, 23, 52, 0.9)",
                          border: "1px solid rgba(59, 130, 246, 0.2)",
                          borderRadius: "12px",
                          fontSize: 12,
                          color: "#e8ecf4",
                        }}
                        formatter={(v: number) => [`${v}%`, "Score"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#scoreGradient)"
                        dot={{ fill: "#3b82f6", strokeWidth: 0, r: 3 }}
                        activeDot={{ r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Topic mastery heatmap + Weak areas */}
            <div className="grid lg:grid-cols-3 gap-4 mt-6">
              {/* Heatmap */}
              <div className="lg:col-span-2 glass-card p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Topic Mastery</span>
                </div>

                {Array.from(subjectGroups.entries()).map(([subject, topics]) => (
                  <div key={subject} className="mb-4 last:mb-0">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {subject}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {topics.map((t) => (
                        <div
                          key={`${t.subject}-${t.topic}`}
                          title={`${t.topic}: ${t.accuracy}% (${t.correct}/${t.total})`}
                          className={cn(
                            "px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-default transition-all hover:scale-105",
                            t.accuracy >= 80
                              ? "bg-success/15 text-success border border-success/20"
                              : t.accuracy >= 60
                                ? "bg-primary/15 text-primary border border-primary/20"
                                : t.accuracy >= 40
                                  ? "bg-warning/15 text-warning border border-warning/20"
                                  : "bg-destructive/15 text-destructive border border-destructive/20",
                          )}
                        >
                          {t.topic.length > 20 ? t.topic.slice(0, 18) + "…" : t.topic}
                          <span className="ml-1 opacity-70">{t.accuracy}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {topicData.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-6">
                    Complete quizzes and mock tests to see topic mastery data.
                  </div>
                )}

                {/* Legend */}
                {topicData.length > 0 && (
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded bg-success/40" /> ≥80%
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded bg-primary/40" /> 60-79%
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded bg-warning/40" /> 40-59%
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded bg-destructive/40" /> &lt;40%
                    </span>
                  </div>
                )}
              </div>

              {/* Weak + Strong areas */}
              <div className="space-y-4">
                {/* Weak areas */}
                <div className="glass-card p-5 rounded-2xl">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="font-semibold text-sm">Needs Attention</span>
                  </div>
                  {weakTopics.length > 0 ? (
                    <div className="space-y-2">
                      {weakTopics.map((t) => (
                        <div
                          key={`${t.subject}-${t.topic}`}
                          className="flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{t.topic}</div>
                            <div className="text-xs text-muted-foreground">{t.subject}</div>
                          </div>
                          <span className="text-sm font-bold text-destructive shrink-0 ml-2">
                            {t.accuracy}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No weak topics detected — great job!
                    </div>
                  )}
                </div>

                {/* Strong areas */}
                <div className="glass-card p-5 rounded-2xl">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="font-semibold text-sm">Strong Topics</span>
                  </div>
                  {strongTopics.length > 0 ? (
                    <div className="space-y-2">
                      {strongTopics.map((t) => (
                        <div
                          key={`${t.subject}-${t.topic}`}
                          className="flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{t.topic}</div>
                            <div className="text-xs text-muted-foreground">{t.subject}</div>
                          </div>
                          <span className="text-sm font-bold text-success shrink-0 ml-2">
                            {t.accuracy}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Keep practicing to identify your strengths.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mock test history */}
            {completedMocks.length > 0 && (
              <div className="glass-card p-6 rounded-2xl mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Mock Test History</span>
                </div>
                <div className="space-y-2">
                  {completedMocks.slice(0, 8).map((t) => {
                    const pct = t.total_marks
                      ? Math.round(((t.score ?? 0) / t.total_marks) * 100)
                      : 0;
                    const mins = t.time_taken_seconds ? Math.round(t.time_taken_seconds / 60) : 0;
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/20 transition-colors"
                      >
                        <div
                          className={cn(
                            "h-10 w-10 rounded-lg grid place-items-center text-sm font-bold font-heading",
                            pct >= 70
                              ? "bg-success/10 text-success"
                              : pct >= 40
                                ? "bg-warning/10 text-warning"
                                : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {pct}%
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{t.exam_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {t.score}/{t.total_marks} · {mins}m ·{" "}
                            {t.created_at ? new Date(t.created_at).toLocaleDateString() : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {t.sections.length} sections
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "primary" | "accent" | "success" | "warning" | "destructive";
}) {
  const colorMap = {
    primary: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
    accent: { bg: "bg-accent/10", text: "text-accent", border: "border-accent/20" },
    success: { bg: "bg-success/10", text: "text-success", border: "border-success/20" },
    warning: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20" },
    destructive: {
      bg: "bg-destructive/10",
      text: "text-destructive",
      border: "border-destructive/20",
    },
  };
  const c = colorMap[accent];
  return (
    <div className="glass-card p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted-foreground font-medium">{label}</div>
        <div
          className={`h-8 w-8 rounded-lg ${c.bg} ${c.text} grid place-items-center border ${c.border}`}
        >
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold font-heading">{value}</div>
    </div>
  );
}
