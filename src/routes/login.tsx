import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — AcePrep" },
      {
        name: "description",
        content: "Sign in to AcePrep and start acing your competitive exams with AI.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const { signInWithGoogle, user, loading } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      navigate({ to: "/" });
    }
  }, [user, loading, navigate]);

  const handleGoogleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sign in. Please try again.");
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating orbs */}
        <div className="absolute top-1/4 left-1/6 w-64 h-64 rounded-full bg-primary/5 blur-3xl animate-float" />
        <div
          className="absolute bottom-1/4 right-1/6 w-80 h-80 rounded-full bg-accent/5 blur-3xl animate-float"
          style={{ animationDelay: "-3s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/5 blur-3xl animate-float"
          style={{ animationDelay: "-1.5s" }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow mb-5">
            <svg
              className="h-8 w-8 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight font-heading">
            <span className="text-gradient">AcePrep</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-2 text-center max-w-xs">
            Ace any competitive exam with AI — mock tests, smart tutoring, and personalized study
            plans.
          </p>
        </div>

        {/* Login card */}
        <div className="glass p-8 rounded-2xl shadow-elegant">
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to continue your prep journey
            </p>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn || loading}
            className="w-full h-12 flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-900 rounded-xl font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {signingIn ? (
              <svg className="w-5 h-5 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {signingIn ? "Signing in..." : "Continue with Google"}
          </button>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">Trusted by students preparing for</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["JEE", "NEET", "SAT", "GRE", "CAT", "UPSC"].map((exam) => (
              <span
                key={exam}
                className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary/80 font-medium"
              >
                {exam}
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
