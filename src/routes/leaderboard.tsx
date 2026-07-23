import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { xpForNextLevel, XP_REWARDS, getTier } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Flame,
  Star,
  Crown,
  Zap,
  ChevronDown,
  ChevronUp,
  Brain,
  BookOpen,
  Timer,
  Upload,
  CreditCard,
  LogIn,
} from "lucide-react";
import { useTutorial } from "@/components/TutorialProvider";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard · AcePrep" },
      { name: "description", content: "See how you rank against other AcePrep students" },
    ],
  }),
  component: LeaderboardPage,
});

/* ─── helpers ────────────────────────────────────────────────────────────── */

/** Derive a short display label from an email address. */
function emailToName(email?: string | null): string {
  if (!email) return "Student";
  const local = email.split("@")[0];
  // Capitalise first letter, replace dots/underscores with spaces
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── XP Guide data ──────────────────────────────────────────────────────── */

const XP_GUIDE_ITEMS = [
  {
    icon: Brain,
    label: "Correct quiz answer",
    xp: XP_REWARDS.quiz_correct,
    color: "var(--feat-quiz)",
  },
  {
    icon: BookOpen,
    label: "Complete mock test",
    xp: XP_REWARDS.mock_complete,
    color: "var(--feat-mock)",
  },
  {
    icon: Timer,
    label: "Focus session (Pomodoro)",
    xp: XP_REWARDS.focus_session,
    color: "var(--feat-focus)",
  },
  {
    icon: CreditCard,
    label: "Rate a review card",
    xp: XP_REWARDS.review_card,
    color: "var(--feat-review)",
  },
  {
    icon: Upload,
    label: "Upload a document",
    xp: XP_REWARDS.upload_doc,
    color: "var(--feat-notes)",
  },
  {
    icon: LogIn,
    label: "Daily login",
    xp: XP_REWARDS.daily_login,
    color: "var(--feat-syllabus)",
  },
];

/* ─── Podium styles ──────────────────────────────────────────────────────── */

const PODIUM_STYLES = [
  {
    bgStyle: { background: "var(--feat-leaderboard-bg)" },
    border: "border-amber-300/40",
    icon: "🥇",
    labelStyle: { color: "var(--feat-leaderboard)" },
  },
  {
    bgStyle: { background: "var(--muted)" },
    border: "border-slate-300/40",
    icon: "🥈",
    labelStyle: { color: "#64748b" },
  },
  {
    bgStyle: { background: "rgba(180,83,9,0.08)" },
    border: "border-orange-300/40",
    icon: "🥉",
    labelStyle: { color: "#c2410c" },
  },
];

/* ─── Component ──────────────────────────────────────────────────────────── */

function LeaderboardPage() {
  const { user } = useAuth();
  const { data: board = [], isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: api.getLeaderboard,
  });
  const { data: myStats } = useQuery({
    queryKey: ["userStats"],
    queryFn: api.getUserStats,
    enabled: !!user,
  });
  const { triggerPageTour } = useTutorial();
  const [showXpGuide, setShowXpGuide] = useState(false);

  useEffect(() => {
    triggerPageTour("leaderboard");
  }, [triggerPageTour]);

  const myRank = board.findIndex((r) => r.user_id === user?.id) + 1;

  // My display name from Supabase auth metadata or email fallback
  const myDisplayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    emailToName(user?.email);

  const myTierInfo = myStats ? getTier(myStats.xp) : null;

  /**
   * Podium: display top-1, top-2, top-3 entries safely.
   * The classic arrangement puts rank-2 left, rank-1 centre, rank-3 right.
   * We only render the podium if at least 1 entry exists; partial podiums
   * (1 or 2 entries) are handled gracefully with empty placeholder cards.
   */
  const podiumEntries = [board[1] ?? null, board[0] ?? null, board[2] ?? null];
  const podiumRanks = [2, 1, 3];
  const showPodium = board.length >= 1;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-glow mb-4">
          <Trophy className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold font-heading">Leaderboard</h1>
        <p className="text-muted-foreground mt-1">Top students by XP earned</p>
      </div>

      {/* XP Guide — collapsible */}
      <div className="card-light rounded-2xl mb-6 overflow-hidden" data-tour="tour-leaderboard-xp">
        <button
          onClick={() => setShowXpGuide((s) => !s)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium transition-colors hover:opacity-80"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <span>How to earn XP</span>
          </div>
          {showXpGuide ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showXpGuide && (
          <div
            className="px-5 pb-4 border-t grid grid-cols-2 sm:grid-cols-3 gap-2"
            style={{ borderColor: "var(--border)" }}
          >
            {XP_GUIDE_ITEMS.map(({ icon: Icon, label, xp, color }) => (
              <div
                key={label}
                className="flex items-center gap-2 p-2.5 rounded-xl text-xs"
                style={{ background: "var(--muted)" }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                <div className="min-w-0">
                  <div className="text-muted-foreground truncate">{label}</div>
                  <div className="font-bold" style={{ color: "var(--feat-leaderboard)" }}>
                    +{xp} XP
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My rank banner */}
      {myStats && myRank > 0 && (
        <div
          className="card-light rounded-2xl p-4 mb-6 flex items-center justify-between border border-primary/20"
          data-tour="tour-leaderboard-rank"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 grid place-items-center text-lg font-bold text-primary">
              #{myRank}
            </div>
            <div>
              <div className="text-sm font-medium">{myDisplayName}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {myStats.xp} XP · Level {myStats.level}
                </span>
                {myTierInfo && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: myTierInfo.tier.bg, color: myTierInfo.tier.color }}
                  >
                    {myTierInfo.tier.emoji} {myTierInfo.tier.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold">{myStats.current_streak} day streak</span>
          </div>
        </div>
      )}

      {/* Top 3 podium — safe for 1, 2, or 3+ entries */}
      {showPodium && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {podiumEntries.map((entry, i) => {
            const podiumRank = podiumRanks[i];
            const style = PODIUM_STYLES[podiumRank - 1];
            const isMe = entry?.user_id === user?.id;

            // Placeholder card for missing entries (e.g. only 1 or 2 users exist)
            if (!entry) {
              return (
                <div
                  key={`empty-${i}`}
                  className="card-light rounded-2xl p-4 text-center border border-dashed opacity-30"
                >
                  <div className="text-2xl mb-1">{style.icon}</div>
                  <div className="h-12 w-12 rounded-full bg-muted/30 mx-auto mb-2" />
                  <div className="text-xs text-muted-foreground">—</div>
                </div>
              );
            }

            return (
              <div
                key={entry.user_id ?? i}
                className={cn(
                  "card-light rounded-2xl p-4 text-center border transition-all",
                  style.border,
                  podiumRank === 1 && "scale-105 shadow-glow-sm",
                  isMe && "ring-2 ring-primary",
                )}
                style={style.bgStyle}
              >
                <div className="text-2xl mb-1">{style.icon}</div>
                <div className="h-12 w-12 rounded-full bg-muted/30 mx-auto mb-2 grid place-items-center text-xl">
                  🎓
                </div>
                {/* Show own name for self; generic rank label for others */}
                <div
                  className="text-sm font-semibold truncate"
                  style={style.labelStyle}
                  title={isMe ? myDisplayName : undefined}
                >
                  {isMe ? myDisplayName.split(" ")[0] : `#${podiumRank}`}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{entry.xp ?? 0} XP</div>
                <div className="text-xs text-muted-foreground">Lv. {entry.level ?? 1}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list (rank 4+) */}
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 card-light rounded-xl animate-pulse" />
            ))
          : board.slice(3).map((entry, idx) => {
              const rank = idx + 4;
              const isMe = entry.user_id === user?.id;
              const { pct } = xpForNextLevel(entry.xp ?? 0);
              const badgeCount = entry.badges?.length ?? 0;

              return (
                <div
                  key={entry.user_id ?? idx}
                  className={cn(
                    "card-light rounded-xl px-4 py-3 flex items-center gap-4 transition-all",
                    isMe && "border border-primary/30",
                  )}
                  style={isMe ? { background: "var(--accent)" } : undefined}
                >
                  {/* Rank number */}
                  <div
                    className="h-9 w-9 shrink-0 rounded-lg grid place-items-center text-sm font-bold"
                    style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
                  >
                    #{rank}
                  </div>

                  {/* Avatar */}
                  <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-primary grid place-items-center text-white text-sm font-bold">
                    {isMe ? myDisplayName.charAt(0).toUpperCase() : "🎓"}
                  </div>

                  {/* Name + XP bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {isMe ? myDisplayName : `Student #${rank}`}
                      </span>
                      {isMe && <span className="text-xs text-primary font-medium">← you</span>}
                    </div>
                    <div
                      className="mt-1 h-1 rounded-full overflow-hidden w-24"
                      style={{ background: "var(--muted)" }}
                    >
                      <div
                        className="h-full progress-fill rounded-full"
                        style={
                          {
                            "--pct": `${pct}%`,
                            background: "var(--gradient-primary)",
                          } as React.CSSProperties
                        }
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Zap className="h-3 w-3 text-amber-400" />
                      <span className="text-sm font-bold">{entry.xp} XP</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
                      <span>Lv.{entry.level}</span>
                      {entry.current_streak > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Flame className="h-2.5 w-2.5 text-amber-400" /> {entry.current_streak}d
                        </span>
                      )}
                      {badgeCount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5 text-primary" /> {badgeCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

        {!isLoading && board.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Crown className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No one on the leaderboard yet. Be the first!</p>
          </div>
        )}
      </div>
    </div>
  );
}
