import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Bot, Sparkles, BrainCircuit, Target, Trophy, ChevronRight, BarChart3, Users, Zap } from "lucide-react";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "AcePrep — Your AI Study Companion" },
      {
        name: "description",
        content: "Ace any competitive exam with AI-powered mock tests, smart tutoring, and personalized study plans.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
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
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20 selection:text-primary">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] animate-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] animate-float" style={{ animationDelay: "-3s" }} />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-emerald-500/10 blur-[120px] animate-float" style={{ animationDelay: "-1.5s" }} />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 40%, transparent 100%)"
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-6 md:px-12 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow-sm">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold font-heading tracking-tight">AcePrep</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="hidden md:flex items-center text-sm font-medium hover:text-primary transition-colors"
          >
            Log in
          </button>
          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:scale-105 active:scale-95 transition-all"
          >
            {signingIn ? "Please wait..." : "Get Started"}
            {!signingIn && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-32 px-6 text-center max-w-5xl mx-auto flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in border border-primary/20">
          <Sparkles className="h-4 w-4" />
          <span>The next generation of exam preparation</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold font-heading tracking-tight leading-[1.1] mb-8 animate-fade-up">
          Master any exam with your <br className="hidden md:block" />
          <span className="text-gradient">Personal AI Tutor</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-up" style={{ animationDelay: "0.1s" }}>
          AcePrep analyzes your weaknesses, generates adaptive mock tests, and teaches you complex concepts step-by-step. Stop guessing, start acing.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-primary text-white text-base font-semibold shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:pointer-events-none"
          >
            {signingIn ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Connecting...
              </span>
            ) : (
              <>
                <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>
        </div>

        <div className="mt-16 flex items-center justify-center gap-6 text-sm text-muted-foreground font-medium animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500" /> Free to start</div>
          <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-primary" /> Advanced AI models</div>
          <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-orange-500" /> 10+ Exams supported</div>
        </div>
      </section>

      {/* App Preview Mockup */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-32">
        <div className="relative rounded-2xl md:rounded-[2rem] border border-border bg-card shadow-2xl overflow-hidden p-2">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 opacity-50" />
          <div className="relative rounded-xl md:rounded-[1.5rem] overflow-hidden border border-border/50 bg-background/50 backdrop-blur-xl aspect-[16/9] flex items-center justify-center">
            {/* Minimalist Dashboard Representation */}
            <div className="w-full h-full flex">
              <div className="w-64 border-r border-border hidden md:flex flex-col p-4 gap-4 opacity-70">
                <div className="h-8 w-2/3 bg-muted rounded-md mb-4" />
                {[1,2,3,4,5].map(i => <div key={i} className="h-10 w-full bg-muted rounded-lg" />)}
              </div>
              <div className="flex-1 p-8 flex flex-col gap-6">
                <div className="h-12 w-1/3 bg-muted rounded-lg" />
                <div className="flex gap-6">
                  <div className="flex-1 h-32 bg-primary/10 rounded-xl border border-primary/20" />
                  <div className="flex-1 h-32 bg-blue-500/10 rounded-xl border border-blue-500/20" />
                  <div className="flex-1 h-32 bg-purple-500/10 rounded-xl border border-purple-500/20" />
                </div>
                <div className="flex-1 bg-muted/50 rounded-2xl border border-border mt-4" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold font-heading mb-4">Everything you need to succeed</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">Powerful AI tools designed specifically for students tackling tough competitive exams.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard 
            icon={<BrainCircuit className="h-6 w-6 text-primary" />}
            title="Socratic AI Tutor"
            description="Our AI doesn't just give you answers. It asks guiding questions, explains concepts step-by-step, and adapts to your learning pace."
          />
          <FeatureCard 
            icon={<Target className="h-6 w-6 text-blue-500" />}
            title="Adaptive Mock Tests"
            description="Generate customized mock tests targeting your weak subjects. Get instant grading with detailed markdown-formatted explanations."
          />
          <FeatureCard 
            icon={<BarChart3 className="h-6 w-6 text-emerald-500" />}
            title="Smart Analytics"
            description="Track your performance over time. See which topics need more focus and measure your progress across different difficulty levels."
          />
          <FeatureCard 
            icon={<Zap className="h-6 w-6 text-yellow-500" />}
            title="Instant PYQs"
            description="Access previous years' questions instantly. The AI explains the nuances of how the exam setters formulate questions."
          />
          <FeatureCard 
            icon={<Trophy className="h-6 w-6 text-orange-500" />}
            title="Gamified Learning"
            description="Earn XP, maintain streaks, and climb the global leaderboard. Turn your grueling study sessions into an engaging game."
          />
          <FeatureCard 
            icon={<Users className="h-6 w-6 text-purple-500" />}
            title="Community Forums"
            description="Discuss difficult concepts with peers. Stuck? Tag the AcePrep AI in the community for an authoritative, detailed answer."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6 relative z-10 bg-card">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold font-heading">AcePrep</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} AcePrep AI. All rights reserved.
          </p>
          <div className="flex gap-4">
            <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">Privacy</span>
            <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">Terms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="card-light p-8 rounded-3xl border border-border hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
      <div className="h-14 w-14 rounded-2xl bg-muted grid place-items-center mb-6 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
