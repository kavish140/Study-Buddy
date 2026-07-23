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
  MoreHorizontal,
  X,
  LogOut,
  Menu,
  Sun,
  Moon,
  Monitor,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { useTutorial } from "./TutorialProvider";
import { useTheme } from "@/hooks/use-theme";
import { useFocusTimer, FOCUS_MODES } from "@/contexts/FocusTimerContext";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tourId?: string;
  colorVar: string;
  bgVar: string;
};

/** ── Feature color map ───────────────────────────────────────────────── */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Study",
    items: [
      {
        to: "/",
        label: "Dashboard",
        icon: LayoutDashboard,
        tourId: "tour-nav-dashboard",
        colorVar: "--feat-dashboard",
        bgVar: "--feat-dashboard-bg",
      },
      {
        to: "/syllabus",
        label: "Syllabus",
        icon: BookOpen,
        tourId: "tour-nav-syllabus",
        colorVar: "--feat-syllabus",
        bgVar: "--feat-syllabus-bg",
      },
      {
        to: "/planner",
        label: "Planner",
        icon: Calendar,
        tourId: "tour-nav-planner",
        colorVar: "--feat-planner",
        bgVar: "--feat-planner-bg",
      },
      {
        to: "/notes",
        label: "Notes",
        icon: FileText,
        tourId: "tour-nav-notes",
        colorVar: "--feat-notes",
        bgVar: "--feat-notes-bg",
      },
    ],
  },
  {
    label: "Practice",
    items: [
      {
        to: "/quiz",
        label: "Quizzes",
        icon: Brain,
        tourId: "tour-nav-quiz",
        colorVar: "--feat-quiz",
        bgVar: "--feat-quiz-bg",
      },
      {
        to: "/mock-test",
        label: "Mock Test",
        icon: Timer,
        tourId: "tour-nav-mock",
        colorVar: "--feat-mock",
        bgVar: "--feat-mock-bg",
      },
      {
        to: "/review",
        label: "Smart Review",
        icon: FlipHorizontal2,
        tourId: "tour-nav-review",
        colorVar: "--feat-review",
        bgVar: "--feat-review-bg",
      },
      {
        to: "/pyq",
        label: "PYQ Bank",
        icon: Library,
        tourId: "tour-nav-pyq",
        colorVar: "--feat-pyq",
        bgVar: "--feat-pyq-bg",
      },
    ],
  },
  {
    label: "Tools",
    items: [
      {
        to: "/chat",
        label: "AI Tutor",
        icon: Sparkles,
        tourId: "tour-nav-chat",
        colorVar: "--feat-chat",
        bgVar: "--feat-chat-bg",
      },
      {
        to: "/teach",
        label: "Teaching Mode",
        icon: Brain,
        colorVar: "--feat-quiz",
        bgVar: "--feat-quiz-bg",
      },
      {
        to: "/focus",
        label: "Focus Timer",
        icon: Flame,
        tourId: "tour-nav-focus",
        colorVar: "--feat-focus",
        bgVar: "--feat-focus-bg",
      },
      {
        to: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        tourId: "tour-nav-analytics",
        colorVar: "--feat-analytics",
        bgVar: "--feat-analytics-bg",
      },
    ],
  },
  {
    label: "Community",
    items: [
      {
        to: "/community",
        label: "Community",
        icon: MessageCircle,
        tourId: "tour-nav-community",
        colorVar: "--feat-community",
        bgVar: "--feat-community-bg",
      },
      {
        to: "/leaderboard",
        label: "Leaderboard",
        icon: Trophy,
        tourId: "tour-nav-leaderboard",
        colorVar: "--feat-leaderboard",
        bgVar: "--feat-leaderboard-bg",
      },
      {
        to: "/settings",
        label: "Settings",
        icon: Settings,
        colorVar: "--primary",
        bgVar: "--accent",
      },
    ],
  },
];

/** Primary tabs shown in the mobile bottom bar (max 4) */
const MOBILE_PRIMARY: NavItem[] = [
  {
    to: "/",
    label: "Home",
    icon: LayoutDashboard,
    colorVar: "--feat-dashboard",
    bgVar: "--feat-dashboard-bg",
  },
  { to: "/quiz", label: "Quiz", icon: Brain, colorVar: "--feat-quiz", bgVar: "--feat-quiz-bg" },
  {
    to: "/chat",
    label: "AI Tutor",
    icon: Sparkles,
    colorVar: "--feat-chat",
    bgVar: "--feat-chat-bg",
  },
  { to: "/focus", label: "Focus", icon: Flame, colorVar: "--feat-focus", bgVar: "--feat-focus-bg" },
];

// Flatten all nav items
const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

// Map route → page title
const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/syllabus": "Syllabus",
  "/planner": "Planner",
  "/notes": "Notes",
  "/quiz": "Quizzes",
  "/mock-test": "Mock Test",
  "/review": "Smart Review",
  "/pyq": "PYQ Bank",
  "/chat": "AI Tutor",
  "/teach": "Teaching Mode",
  "/focus": "Focus Timer",
  "/analytics": "Analytics",
  "/community": "Community",
  "/leaderboard": "Leaderboard",
  "/settings": "Settings",
};

function getPageTitle(path: string): string {
  if (path === "/") return "Dashboard";
  for (const [route, title] of Object.entries(PAGE_TITLES)) {
    if (route !== "/" && path.startsWith(route)) return title;
  }
  return "AcePrep";
}

/** ── Feature Tile component ─────────────────────────────────────────── */
function FeatureTile({
  item,
  active,
  dueCount,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  dueCount?: number;
  onClick: () => void;
}) {
  const { icon: Icon, label, to, colorVar, bgVar } = item;
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn("feature-tile", active && "active")}
      style={
        active
          ? {
              background: `var(${bgVar})`,
              borderColor: `var(${colorVar})`,
              borderWidth: "1.5px",
            }
          : undefined
      }
    >
      <div className="feature-tile__icon" style={{ background: `var(${bgVar})` }}>
        <Icon className="h-5 w-5" style={{ color: `var(${colorVar})` }} />
        {dueCount != null && dueCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold grid place-items-center z-10">
            {dueCount > 9 ? "9+" : dueCount}
          </span>
        )}
      </div>
      <span
        className="feature-tile__label"
        style={active ? { color: `var(${colorVar})` } : undefined}
      >
        {label}
      </span>
    </Link>
  );
}

/** ── Feature Panel ─────────────────────────────────────────────────── */
function FeaturePanel({
  open,
  onClose,
  isActive,
  dueCards,
  user,
  userStats,
  profile,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  isActive: (to: string) => boolean;
  dueCards: unknown[];
  user: { email?: string | null } | null;
  userStats: { xp: number; level: number; current_streak: number } | null | undefined;
  profile: { exam_name?: string | null; display_name?: string | null; avatar_emoji?: string | null } | null | undefined;
  onSignOut: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="feature-panel-backdrop" onClick={onClose} />
      <div className="feature-panel">
        {/* Header */}
        <div className="feature-panel__header">
          <div className="feature-panel__logo">
            <div className="top-bar__logo-icon">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <div>
              <div
                className="font-bold text-[15px] leading-tight"
                style={{ color: "var(--foreground)" }}
              >
                AcePrep
              </div>
              {profile?.exam_name && (
                <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                  {profile.exam_name}
                </div>
              )}
            </div>
          </div>
          <button className="feature-panel__close" onClick={onClose} aria-label="Close panel">
            <X size={18} />
          </button>
        </div>

        {/* Nav Groups */}
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="feature-panel__group-label">{group.label}</div>
            <div className="feature-panel__grid">
              {group.items.map((item) => {
                const dueCount = item.to === "/review" ? dueCards.length : 0;
                return (
                  <FeatureTile
                    key={item.to}
                    item={item}
                    active={isActive(item.to)}
                    dueCount={dueCount}
                    onClick={onClose}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* User info + sign out */}
        <div className="mt-auto p-4 border-t" style={{ borderColor: "var(--border)" }}>
          {userStats &&
            (() => {
              const { pct, current, needed } = xpForNextLevel(userStats.xp);
              return (
                <div className="mb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs font-semibold">{userStats.xp} XP</span>
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        · Lv.{userStats.level}
                      </span>
                    </div>
                    {userStats.current_streak > 0 && (
                      <div className="flex items-center gap-0.5 text-[11px] text-amber-500">
                        <Flame className="h-3 w-3" />
                        {userStats.current_streak}d
                      </div>
                    )}
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--muted)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: "linear-gradient(90deg, #f59e0b, #f97316)",
                      }}
                    />
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                    {current}/{needed} XP to Lv.{userStats.level + 1}
                  </div>
                </div>
              );
            })()}

          <div className="flex items-center gap-2">
            <div
              className="top-bar__avatar text-xs"
              title={profile?.display_name || user?.email || undefined}
            >
              {profile?.avatar_emoji ?? user?.email?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">
                {profile?.display_name || user?.email}
              </div>
            </div>
            <Link
              to="/settings"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition-colors hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              title="Settings"
              onClick={onClose}
            >
              <Settings size={12} />
            </Link>
            <button
              onClick={onSignOut}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition-colors hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              <LogOut size={12} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { triggerPageTour } = useTutorial();
  const { effectiveTheme, toggle } = useTheme();
  // Global focus timer — used to show the floating mini-widget when away from /focus
  const { isRunning: timerRunning, secondsLeft: timerSeconds, mode: timerMode } = useFocusTimer();

  const [panelOpen, setPanelOpen] = useState(false);
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

  // Award daily login XP once per day
  useEffect(() => {
    if (!user) return;
    const today = todayIST();
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

  // Auth guard — send unauthenticated visitors to the landing page
  useEffect(() => {
    if (!loading && !user && path !== "/login" && path !== "/landing") {
      navigate({ to: "/landing" });
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
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background)" }}
      >
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div
            className="h-14 w-14 rounded-2xl grid place-items-center shadow-glow animate-pulse"
            style={{ background: "var(--gradient-primary)" }}
          >
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <div className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
            Loading…
          </div>
        </div>
      </div>
    );
  }

  if (!user && path !== "/login" && path !== "/onboarding") return null;

  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  const handleSignOut = async () => {
    setPanelOpen(false);
    setMoreOpen(false);
    try {
      await signOut();
    } finally {
      navigate({ to: "/login" });
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <header className="top-bar">
        {/* Menu button */}
        <button
          className="top-bar__menu-btn"
          onClick={() => setPanelOpen(true)}
          aria-label="Open navigation"
          data-tour="tour-nav-dashboard"
        >
          <Menu size={20} />
        </button>

        {/* Logo */}
        <Link to="/" className="top-bar__logo ml-2">
          <div className="top-bar__logo-icon">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="top-bar__logo-name hidden sm:block">AcePrep</span>
        </Link>

        {/* Page title — centered */}
        <div className="top-bar__page-title">{getPageTitle(path)}</div>

        {/* Right side */}
        <div className="top-bar__right">
          {/* XP pill */}
          {userStats && (
            <div className="top-bar__xp-pill hidden sm:flex">
              <Zap size={11} className="text-amber-500" />
              <span>{userStats.xp} XP</span>
              <span style={{ color: "var(--muted-foreground)" }}>· Lv.{userStats.level}</span>
              {userStats.current_streak > 0 && (
                <>
                  <span style={{ color: "var(--border)" }}>·</span>
                  <Flame size={11} className="text-amber-500" />
                  <span>{userStats.current_streak}d</span>
                </>
              )}
            </div>
          )}

          {/* Floating focus timer mini-widget — visible when timer is running on another page */}
          {timerRunning && path !== "/focus" && (() => {
            const m = Math.floor(timerSeconds / 60);
            const s = timerSeconds % 60;
            return (
              <Link
                to="/focus"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                style={{
                  background: "var(--feat-focus-bg)",
                  color: "var(--feat-focus)",
                  border: "1px solid var(--feat-focus)",
                }}
                title={`${FOCUS_MODES[timerMode].label} — click to open timer`}
              >
                <Flame size={11} className="animate-pulse" />
                <span className="tabular-nums">
                  {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
                </span>
              </Link>
            );
          })()}

          {/* Due cards badge */}
          {dueCards.length > 0 && (
            <Link
              to="/review"
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
              style={{
                background: "rgba(239,68,68,0.1)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <FlipHorizontal2 size={11} />
              {dueCards.length} due
            </Link>
          )}

          {/* Theme toggle */}
          <button
            className="top-bar__theme-btn"
            onClick={toggle}
            aria-label="Toggle theme"
            title={effectiveTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {effectiveTheme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Avatar — shows emoji if set, else email initial */}
          <div className="top-bar__avatar" title={profile?.display_name || user?.email || undefined}>
            {profile?.avatar_emoji ?? user?.email?.charAt(0).toUpperCase() ?? "?"}
          </div>
        </div>
      </header>

      {/* ── Feature Panel ─────────────────────────────────────────────── */}
      <FeaturePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        isActive={isActive}
        dueCards={dueCards}
        user={user}
        userStats={userStats}
        profile={profile}
        onSignOut={handleSignOut}
      />

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-y-auto pb-20 md:pb-0 animate-fade-up">
        <Outlet />
      </main>

      {/* ── Mobile bottom tab bar ────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-20"
        style={{
          background:
            effectiveTheme === "dark" ? "rgba(6, 9, 26, 0.95)" : "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="flex justify-around items-center h-16 px-1">
          {MOBILE_PRIMARY.map(({ to, label, icon: Icon, colorVar }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[56px] relative"
                style={{ color: active ? `var(${colorVar})` : "var(--muted-foreground)" }}
              >
                {active && (
                  <div
                    className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                    style={{ background: `var(${colorVar})` }}
                  />
                )}
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-semibold">{label}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[56px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-semibold">More</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile "More" sheet ─────────────────────────────────────── */}
      {moreOpen && (
        <>
          <div className="mobile-sheet-backdrop md:hidden" onClick={() => setMoreOpen(false)} />
          <div className="mobile-sheet md:hidden">
            <div className="mobile-sheet__handle" />
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-sm font-bold">All Features</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--muted-foreground)" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Feature grid in sheet */}
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-3">
                <div
                  className="text-[10px] font-bold uppercase tracking-widest mb-2 px-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {group.label}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {group.items.map((item) => {
                    const dueCount = item.to === "/review" ? dueCards.length : 0;
                    return (
                      <FeatureTile
                        key={item.to}
                        item={item}
                        active={isActive(item.to)}
                        dueCount={dueCount}
                        onClick={() => setMoreOpen(false)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {/* User info in sheet */}
            <div
              className="mt-3 pt-3 border-t flex items-center gap-2"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="top-bar__avatar text-xs shrink-0">
                {user?.email?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{user?.email}</div>
                {userStats && (
                  <div
                    className="text-[10px] flex items-center gap-1"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <Zap size={9} className="text-amber-500" />
                    {userStats.xp} XP · Lv.{userStats.level}
                  </div>
                )}
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                <LogOut size={12} />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
