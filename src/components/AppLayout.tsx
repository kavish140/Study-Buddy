import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BookOpen, Brain, Calendar, FileText, LayoutDashboard, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/syllabus", label: "Syllabus", icon: BookOpen },
  { to: "/quiz", label: "Quizzes", icon: Brain },
  { to: "/planner", label: "Planner", icon: Calendar },
  { to: "/notes", label: "Notes", icon: FileText },
] as const;

export function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user && path !== "/login") {
      navigate({ to: "/login" });
    }
  }, [user, loading, path, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user && path !== "/login") return null;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border p-5">
        <Link to="/" className="flex items-center gap-2 mb-10">
          <div className="h-9 w-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">StudyForge</div>
            <div className="text-xs text-muted-foreground">AI study OS</div>
          </div>
        </Link>
        <nav className="flex flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-elegant"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <div className="text-xs text-muted-foreground px-1">
            Logged in as {user?.email}
          </div>
          <button
            onClick={signOut}
            className="text-left text-sm text-muted-foreground hover:text-foreground px-1"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-2 p-4 border-b border-border bg-sidebar">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold">StudyForge</span>
        </header>
        <nav className="md:hidden flex gap-1 overflow-x-auto p-2 border-b border-border bg-sidebar">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
