import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { xpForNextLevel, BADGE_DEFS } from "@/lib/storage";
import {
  BookOpen,
  Brain,
  Calendar,
  FileText,
  LayoutDashboard,
  GraduationCap,
  Timer,
  BarChart3,
  Sparkles,
  FlipHorizontal2,
  Flame,
  Trophy,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/syllabus", label: "Syllabus", icon: BookOpen },
  { to: "/quiz", label: "Quizzes", icon: Brain },
  { to: "/mock-test", label: "Mock Test", icon: Timer },
  { to: "/review", label: "Smart Review", icon: FlipHorizontal2 },
  { to: "/focus", label: "Focus Timer", icon: Flame },
  { to: "/planner", label: "Planner", icon: Calendar },
  { to: "/notes", label: "Notes", icon: FileText },
  { to: "/chat", label: "AI Tutor", icon: Sparkles },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
] as const;

export function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const qc = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: api.getUserProfile,
    enabled: !!user,
  });

  const { data: userStats } = useQuery({
    queryKey: ["userStats"],
    queryFn: api.getUserStats,
    enabled: !!user,
  });

  const awardMutation = useMutation({
    mutationFn: () => api.awardXP(5), // daily login XP
    onSuccess: ({ newBadges }) => {
      qc.invalidateQueries({ queryKey: ["userStats"] });
      newBadges.forEach((id) => {
        const badge = BADGE_DEFS.find((b) => b.id === id);
        if (badge) toast.success(`${badge.emoji} Badge unlocked: ${badge.name}!`, { duration: 5000 });
      });
    },
  });

  // Award daily login XP once per day
  useEffect(() => {
    if (!user) return;
    const todayKey = `aceprep_login_${new Date().toISOString().split("T")[0]}`;
    if (!localStorage.getItem(todayKey)) {
      localStorage.setItem(todayKey, "1");
      awardMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const { data: dueCards = [] } = useQuery({
    queryKey: ["reviewCards"],
    queryFn: api.getDueReviewCards,
    enabled: !!user,
    refetchInterval: 60_000, // refresh every minute
  });

  useEffect(() => {
    if (!loading && !user && path !== "/login") {
      navigate({ to: "/login" });
    }
  }, [user, loading, path, navigate]);

  useEffect(() => {
    if (
      user &&
      !profileLoading &&
      !profile?.onboarding_completed &&
      path !== "/onboarding" &&
      path !== "/login"
    ) {
      navigate({ to: "/onboarding" });
    }
  }, [user, profileLoading, profile, path, navigate]);

  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-primary grid place-items-center shadow-glow animate-pulse">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user && path !== "/login") return null;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar p-5 relative">
        {/* Subtle glow at top */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

        <Link to="/" className="flex items-center gap-3 mb-10 relative">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow-sm">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-bold tracking-tight font-heading text-lg">AcePrep</div>
            <div className="text-xs text-muted-foreground">
              {profile?.exam_name || "Exam prep OS"}
            </div>
          </div>
        </Link>

        <nav className="flex flex-col gap-1 relative">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            const dueCount = to === "/review" ? dueCards.length : 0;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200",
                  active
                    ? "bg-primary/12 text-primary shadow-sm border border-primary/15"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4", active && "text-primary")} />
                <span className={cn(active && "font-medium")}>{label}</span>
                {dueCount > 0 && (
                  <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">
                    {dueCount > 99 ? "99+" : dueCount}
                  </span>
                )}
                {active && dueCount === 0 && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-glow-sm" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom user section */}
        <div className="mt-auto pt-4 border-t border-sidebar-border space-y-3">
          {/* XP Progress bar */}
          {userStats && (() => {
            const { pct, current, needed } = xpForNextLevel(userStats.xp);
            return (
              <div className="px-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs font-semibold">{userStats.xp} XP</span>
                    <span className="text-xs text-muted-foreground">· Lv.{userStats.level}</span>
                  </div>
                  {userStats.current_streak > 0 && (
                    <div className="flex items-center gap-1 text-xs text-amber-400">
                      <Flame className="h-3 w-3" />
                      {userStats.current_streak}d
                    </div>
                  )}
                </div>
                <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{current}/{needed} XP to Lv.{userStats.level + 1}</div>
                {userStats.badges.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {userStats.badges.slice(0, 6).map((id) => {
                      const b = BADGE_DEFS.find((bd) => bd.id === id);
                      return b ? <span key={id} title={b.name} className="text-sm cursor-default">{b.emoji}</span> : null;
                    })}
                    {userStats.badges.length > 6 && <span className="text-xs text-muted-foreground">+{userStats.badges.length - 6}</span>}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-full bg-gradient-primary grid place-items-center text-xs font-bold text-white">
              {user?.email?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border glass">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold font-heading">AcePrep</span>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-border">
          <div className="flex justify-around items-center h-16 px-2">
            {nav.map(({ to, label, icon: Icon }) => {
              const active = to === "/" ? path === "/" : path.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-[56px]",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active && "drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]",
                    )}
                  />
                  <span className="text-[10px] font-medium">{label}</span>
                  {active && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-primary rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
