import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { xpForNextLevel } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Trophy, Flame, Star, Crown, Zap } from "lucide-react";
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

const RANK_STYLES = [
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

  useEffect(() => {
    triggerPageTour("leaderboard");
  }, [triggerPageTour]);

  const myRank = board.findIndex((r) => r.user_id === user?.id) + 1;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-glow mb-4">
          <Trophy className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold font-heading">Leaderboard</h1>
        <p className="text-muted-foreground mt-1">Top students by XP earned</p>
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
              <div className="text-sm font-medium">Your rank</div>
              <div className="text-xs text-muted-foreground">
                {myStats.xp} XP · Level {myStats.level}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold">{myStats.current_streak} day streak</span>
          </div>
        </div>
      )}

      {/* Top 3 podium */}
      {board.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[board[1], board[0], board[2]].map((entry, i) => {
            const podiumRank = [2, 1, 3][i];
            const style = RANK_STYLES[podiumRank - 1];
            const isMe = entry?.user_id === user?.id;
            return (
              <div
                key={entry?.user_id ?? i}
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
                <div className="text-sm font-semibold truncate" style={style.labelStyle}>
                  {isMe ? "You" : `#${podiumRank}`}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{entry?.xp ?? 0} XP</div>
                <div className="text-xs text-muted-foreground">Lv. {entry?.level ?? 1}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list */}
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
                  {/* Rank */}
                  <div
                    className="h-9 w-9 shrink-0 rounded-lg grid place-items-center text-sm font-bold"
                    style={
                      rank === 1
                        ? {
                            background: "var(--feat-leaderboard-bg)",
                            color: "var(--feat-leaderboard)",
                          }
                        : rank === 2
                          ? { background: "var(--muted)", color: "#64748b" }
                          : rank === 3
                            ? { background: "rgba(180,83,9,0.08)", color: "#c2410c" }
                            : { background: "var(--muted)", color: "var(--muted-foreground)" }
                    }
                  >
                    {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : `#${rank}`}
                  </div>

                  {/* Avatar */}
                  <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-primary grid place-items-center text-white text-sm font-bold">
                    {isMe ? "You" : "🎓"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {isMe ? "You" : `Student #${rank}`}
                      </span>
                      {isMe && <span className="text-xs text-primary font-medium">← you</span>}
                    </div>
                    {/* XP progress bar */}
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
