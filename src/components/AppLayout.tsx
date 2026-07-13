import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ComponentType } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { xpForNextLevel, BADGE_DEFS } from "@/lib/storage";
import { todayIST } from "@/lib/date-utils";
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
  Library,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { useTutorial } from "./TutorialProvider";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tourId?: string;
};

/** ── Navigation groups ───────────────────────────────────────────────── */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Study",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, tourId: "tour-nav-dashboard" },
      { to: "/syllabus", label: "Syllabus", icon: BookOpen, tourId: "tour-nav-syllabus" },
      { to: "/planner", label: "Planner", icon: Calendar, tourId: "tour-nav-planner" },
      { to: "/notes", label: "Notes", icon: FileText, tourId: "tour-nav-notes" },
    ],
  },
  {
    label: "Practice",
    items: [
      { to: "/quiz", label: "Quizzes", icon: Brain, tourId: "tour-nav-quiz" },
      { to: "/mock-test", label: "Mock Test", icon: Timer, tourId: "tour-nav-mock" },
      { to: "/review", label: "Smart Review", icon: FlipHorizontal2, tourId: "tour-nav-review" },
      { to: "/pyq", label: "PYQ Bank", icon: Library, tourId: "tour-nav-pyq" },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/chat", label: "AI Tutor", icon: Sparkles, tourId: "tour-nav-chat" },
      { to: "/focus", label: "Focus Timer", icon: Flame, tourId: "tour-nav-focus" },
      { to: "/analytics", label: "Analytics", icon: BarChart3, tourId: "tour-nav-analytics" },
    ],
  },
  {
    label: "Community",
    items: [
      { to: "/community", label: "Community", icon: MessageCircle, tourId: "tour-nav-community" },
      { to: "/leaderboard", label: "Leaderboard", icon: Trophy, tourId: "tour-nav-leaderboard" },
    ],
  },
];

/** Primary tabs shown in the mobile bottom bar (max 5) */
const MOBILE_PRIMARY: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/quiz", label: "Quiz", icon: Brain },
  { to: "/chat", label: "AI Tutor", icon: Sparkles },
  { to: "/focus", label: "Focus", icon: Flame },
];

// Flatten all nav items for helpers
const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { triggerPageTour } = useTutorial();

  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

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
    mutationFn: () => api.awardXP(5),
    onSuccess: ({ newBadges }) => {
      qc.invalidateQueries({ queryKey: ["userStats"] });
      newBadges.forEach((id) => {
        const badge = BADGE_DEFS.find((b) => b.id === id);
        if (badge)
          toast.success(`${badge.emoji} Badge unlocked: ${badge.name}!`, { duration: 5000 });
      });
    },
    onError: (err) => {
      console.warn("Failed to award daily login XP", err);
    },
  });

  // Award daily login XP once per day, scoped to the current user to avoid cross-user leakage
  useEffect(() => {
    if (!user) return;
    const today = todayIST();
    // Key includes user.id so two users on the same browser each get their XP
    const todayKey = `aceprep_login_${user.id}_${today}`;
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
    refetchInterval: 60_000,
  });

  // Auth guard
  useEffect(() => {
    if (!loading && !user && path !== "/login") {
      navigate({ to: "/login" });
    }
  }, [user, loading, path, navigate]);

  // Onboarding guard
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

  // Auto-trigger global tour for new users (after onboarding)
  useEffect(() => {
    if (user && profile?.onboarding_completed && path === "/") {
      triggerPageTour("global");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.onboarding_completed]);

  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-primary grid place-items-center shadow-glow animate-pulse">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div className="text-sm text-muted-foreground">Loading…</div>
        </div>
      </div>
    );
  }

  if (!user && path !== "/login") return null;

  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* ── Desktop Sidebar ────────────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar relative transition-all duration-300 ease-in-out overflow-hidden",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        {/* Subtle top glow */}
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-primary/6 to-transparent pointer-events-none" />

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 px-4 py-5 relative shrink-0">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow-sm shrink-0">
            <GraduationCap className="h-4.5 w-4.5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <div className="font-bold tracking-tight font-heading text-base leading-tight">
                AcePrep
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {profile?.exam_name || "Exam prep OS"}
              </div>
            </div>
          )}
        </Link>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-4 relative">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {group.label}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ to, label, icon: Icon, tourId }) => {
                  const active = isActive(to);
                  const dueCount = to === "/review" ? dueCards.length : 0;
                  return (
                    <div key={to} className="relative group/navitem">
                      <Link
                        to={to}
                        data-tour={tourId}
                        className={cn(
                          "flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm transition-all duration-150 w-full",
                          active
                            ? "bg-primary/12 text-primary border border-primary/15 shadow-sm"
                            : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                        {!collapsed && (
                          <span className={cn("truncate", active && "font-medium")}>{label}</span>
                        )}
                        {!collapsed && dueCount > 0 && (
                          <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold grid place-items-center">
                            {dueCount > 99 ? "99+" : dueCount}
                          </span>
                        )}
                        {!collapsed && active && dueCount === 0 && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-glow-sm" />
                        )}
                        {collapsed && dueCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold grid place-items-center">
                            {dueCount > 9 ? "9+" : dueCount}
                          </span>
                        )}
                      </Link>
                      {/* Collapsed tooltip */}
                      {collapsed && (
                        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-popover border border-border text-xs font-medium whitespace-nowrap shadow-elegant opacity-0 pointer-events-none group-hover/navitem:opacity-100 transition-opacity duration-150 z-50">
                          {label}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: XP + user */}
        <div className="mt-auto border-t border-sidebar-border p-3 space-y-3">
          {/* XP bar */}
          {userStats &&
            (() => {
              const { pct, current, needed } = xpForNextLevel(userStats.xp);
              return (
                <div className={cn("space-y-1", collapsed && "hidden")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-amber-400" />
                      <span className="text-xs font-semibold">{userStats.xp} XP</span>
                      <span className="text-xs text-muted-foreground">· Lv.{userStats.level}</span>
                    </div>
                    {userStats.current_streak > 0 && (
                      <div className="flex items-center gap-0.5 text-[11px] text-amber-400">
                        <Flame className="h-3 w-3" />
                        {userStats.current_streak}d
                      </div>
                    )}
                  </div>
                  <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {current}/{needed} XP to Lv.{userStats.level + 1}
                  </div>
                </div>
              );
            })()}

          {/* User row */}
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-primary grid place-items-center text-[11px] font-bold text-white shrink-0">
              {user?.email?.charAt(0).toUpperCase() || "?"}
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium truncate">{user?.email}</div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await signOut();
                    } finally {
                      navigate({ to: "/login" });
                    }
                  }}
                  title="Sign out"
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <LogOut size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-sidebar border border-sidebar-border shadow-elegant grid place-items-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all z-10"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border glass sticky top-0 z-20">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center shrink-0">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold font-heading">AcePrep</span>
          {profile?.exam_name && (
            <span className="ml-1 text-xs text-muted-foreground">· {profile.exam_name}</span>
          )}
          {dueCards.length > 0 && (
            <Link
              to="/review"
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/15 text-red-400 text-xs font-medium border border-red-500/20"
            >
              <FlipHorizontal2 size={11} />
              {dueCards.length} due
            </Link>
          )}
          {userStats && (
            <div className="flex items-center gap-1 text-xs text-amber-400 ml-auto">
              <Zap size={11} />
              {userStats.xp}
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* ── Mobile bottom tab bar ────────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-border z-20">
          <div className="flex justify-around items-center h-16 px-1">
            {MOBILE_PRIMARY.map(({ to, label, icon: Icon }) => {
              const active = isActive(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[56px] relative",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {active && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gradient-primary rounded-full" />
                  )}
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active && "drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]",
                    )}
                  />
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              );
            })}

            {/* More button */}
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[56px] text-muted-foreground"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </div>
        </nav>

        {/* ── Mobile "More" sheet ──────────────────────────────────────── */}
        {moreOpen && (
          <>
            <div className="mobile-sheet-backdrop md:hidden" onClick={() => setMoreOpen(false)} />
            <div className="mobile-sheet md:hidden">
              <div className="mobile-sheet__handle" />
              <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-sm font-semibold">All Features</span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-sidebar-accent text-muted-foreground"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {ALL_NAV.map(({ to, label, icon: Icon }) => {
                  const active = isActive(to);
                  const dueCount = to === "/review" ? dueCards.length : 0;
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center transition-all",
                        active
                          ? "bg-primary/10 border-primary/20 text-primary"
                          : "border-border text-muted-foreground hover:bg-sidebar-accent",
                      )}
                    >
                      <div className="relative">
                        <Icon className="h-5 w-5" />
                        {dueCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold grid place-items-center">
                            {dueCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium leading-tight">{label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* User info in sheet */}
              <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-primary grid place-items-center text-xs font-bold text-white shrink-0">
                  {user?.email?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{user?.email}</div>
                  {userStats && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Zap size={9} className="text-amber-400" />
                      {userStats.xp} XP · Lv.{userStats.level}
                    </div>
                  )}
                </div>
                <button
                  onClick={async () => {
                    try {
                      await signOut();
                    } finally {
                      navigate({ to: "/login" });
                    }
                    setMoreOpen(false);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LogOut size={12} />
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
