import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Brain,
  Sparkles,
  BarChart3,
  FlipHorizontal2,
  Timer,
  MessageCircle,
  Target,
  Flame,
  Trophy,
  ArrowRight,
  GraduationCap,
  Zap,
  CheckCircle2,
  Star,
  BookOpen,
  ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "AcePrep — Ace Any Competitive Exam with AI" },
      {
        name: "description",
        content:
          "AI-powered exam prep for JEE, NEET, UPSC, CAT & more. Mock tests, smart flashcards, AI tutor, analytics — all in one platform.",
      },
    ],
  }),
  component: LandingPage,
});

/* ─── Data ───────────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI Tutor",
    desc: "Ask anything, get crystal-clear explanations with step-by-step solutions. Available 24/7.",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
  },
  {
    icon: Brain,
    title: "AI Quizzer",
    desc: "Generates exam-pattern questions tailored to your syllabus and difficulty level.",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
  },
  {
    icon: Timer,
    title: "Mock Tests",
    desc: "Full-length timed mock exams with instant scoring, detailed analysis, and wrong-question review.",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
  },
  {
    icon: FlipHorizontal2,
    title: "Smart Flashcards",
    desc: "Spaced repetition flashcards auto-generated from your notes. Never forget a concept.",
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    desc: "Track accuracy trends, weak subjects, and time-on-task. Know exactly where to focus.",
    color: "#f43f5e",
    bg: "rgba(244,63,94,0.12)",
  },
  {
    icon: MessageCircle,
    title: "Community",
    desc: "Discuss doubts with peers. AI automatically answers unresolved questions.",
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.12)",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Pick Your Exam",
    desc: "Select from JEE, NEET, UPSC, CAT, SAT, GRE and more. AcePrep instantly loads the right syllabus and question patterns.",
    color: "#8b5cf6",
  },
  {
    n: "02",
    title: "Study Smarter",
    desc: "Use AI Tutor, mock tests, and smart flashcards to learn faster. The adaptive engine focuses on your weak spots.",
    color: "#3b82f6",
  },
  {
    n: "03",
    title: "Track & Improve",
    desc: "Analytics surface your progress, streak, and rank. Climb the leaderboard and hit your target score.",
    color: "#10b981",
  },
];

const EXAMS = [
  { label: "JEE Main", icon: "⚗️", color: "#3b82f6" },
  { label: "JEE Advanced", icon: "🔬", color: "#6366f1" },
  { label: "NEET", icon: "🧬", color: "#10b981" },
  { label: "UPSC", icon: "🏛️", color: "#f59e0b" },
  { label: "CAT", icon: "📊", color: "#f43f5e" },
  { label: "SAT", icon: "🎓", color: "#8b5cf6" },
  { label: "GRE", icon: "📝", color: "#06b6d4" },
  { label: "GATE", icon: "⚙️", color: "#a855f7" },
];

const STATS = [
  { value: "10,000+", label: "Active Students", icon: "🎓" },
  { value: "50,000+", label: "Questions Practiced", icon: "✅" },
  { value: "95%", label: "Satisfaction Rate", icon: "⭐" },
  { value: "Free", label: "Always", icon: "🚀" },
];

const TESTIMONIALS = [
  {
    name: "Aditya R.",
    exam: "JEE Advanced",
    text: "The AI tutor explained integration by parts better than my coaching class. Cleared JEE with AIR 847.",
    emoji: "🏆",
    stars: 5,
  },
  {
    name: "Priya S.",
    exam: "NEET",
    text: "Smart flashcards saved me during the final week. I reviewed 300 cards in 2 hours without fatigue.",
    emoji: "🧬",
    stars: 5,
  },
  {
    name: "Karan M.",
    exam: "CAT",
    text: "Analytics showed I was wasting time on DI and weak in Quant. Fixed both in 3 weeks. 98.4 percentile!",
    emoji: "📊",
    stars: 5,
  },
];

/* ─── Hook: animate on scroll ─────────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─── Components ─────────────────────────────────────────────────────────── */

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{ background: "var(--background)", color: "var(--foreground)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Sticky Nav ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "var(--background)" : "transparent",
          borderBottom: scrolled ? "1px solid var(--border)" : "none",
          backdropFilter: scrolled ? "blur(16px)" : "none",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-primary grid place-items-center shadow-glow-sm">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg font-heading">AcePrep</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-semibold hover:opacity-90 transition-all hover:shadow-glow-sm"
              style={{ background: "var(--gradient-primary)" }}
            >
              Start Free <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-5 pt-16 pb-24">
        {/* Background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-1/4 left-1/6 w-96 h-96 rounded-full opacity-30 animate-float"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)", filter: "blur(40px)" }}
          />
          <div
            className="absolute bottom-1/4 right-1/6 w-80 h-80 rounded-full opacity-25 animate-float"
            style={{ background: "radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)", filter: "blur(40px)", animationDelay: "-3s" }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10 animate-float"
            style={{ background: "radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 60%)", filter: "blur(60px)", animationDelay: "-1.5s" }}
          />
          {/* Grid */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div className="relative max-w-4xl mx-auto animate-fade-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-6"
            style={{ borderColor: "var(--primary)", color: "var(--primary)", background: "var(--accent)" }}>
            <Zap className="h-3 w-3" /> AI-Powered Exam Prep · Free Forever
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight font-heading leading-[1.05] mb-6">
            Ace Any{" "}
            <span
              className="text-gradient"
              style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              Competitive Exam
            </span>
            <br />
            <span className="text-foreground">with AI</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Mock tests, AI tutor, smart flashcards, deep analytics, and a study community —
            all in one platform designed for JEE, NEET, UPSC, CAT, and beyond.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            <Link
              to="/login"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white font-bold text-base hover:opacity-90 transition-all hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Sparkles className="h-4 w-4" /> Start for Free
            </Link>
            <a
              href="#features"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-base border transition-all hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--muted)" }}
            >
              See Features <ChevronDown className="h-4 w-4" />
            </a>
          </div>

          {/* Exam chips */}
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMS.map((e) => (
              <span
                key={e.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
                style={{ borderColor: `${e.color}30`, background: `${e.color}12`, color: e.color }}
              >
                {e.icon} {e.label}
              </span>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce opacity-50">
          <ChevronDown className="h-5 w-5" />
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="relative py-12 border-y" style={{ borderColor: "var(--border)", background: "var(--accent)" }}>
        <div className="max-w-5xl mx-auto px-5 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {STATS.map((s, i) => (
            <FadeIn key={s.label} delay={i * 80} className="text-center">
              <div className="text-3xl mb-1">{s.icon}</div>
              <div className="text-2xl font-extrabold font-heading text-gradient">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
              style={{ background: "var(--accent)", color: "var(--primary)" }}>
              <Target className="h-3 w-3" /> Everything you need
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold font-heading mb-4">
              One platform, <span className="text-gradient">every feature</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              No more juggling apps. AcePrep puts your entire exam prep workflow in one beautifully designed place.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <FadeIn key={f.title} delay={i * 70}>
                  <div
                    className="card-light p-6 rounded-2xl h-full group cursor-default transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative overflow-hidden"
                    style={{ borderTop: `3px solid ${f.color}` }}
                  >
                    <div
                      className="absolute -right-8 -top-8 h-24 w-24 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: f.bg, filter: "blur(20px)" }}
                    />
                    <div
                      className="h-11 w-11 rounded-xl grid place-items-center mb-4 transition-transform group-hover:scale-110 duration-200"
                      style={{ background: f.bg, color: f.color }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-base mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        className="py-24 px-5 relative"
        style={{ background: "var(--accent)" }}
      >
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
              style={{ background: "var(--background)", color: "var(--primary)", border: "1px solid var(--border)" }}>
              <BookOpen className="h-3 w-3" /> Simple by design
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold font-heading mb-4">
              Up and running in <span className="text-gradient">3 steps</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              No complex setup. Sign in with Google and start prepping in under a minute.
            </p>
          </FadeIn>

          <div className="space-y-6">
            {STEPS.map((step, i) => (
              <FadeIn key={step.n} delay={i * 120}>
                <div className="card-light rounded-2xl p-6 flex items-start gap-5 group hover:-translate-y-0.5 transition-transform duration-200">
                  <div
                    className="text-3xl font-extrabold font-heading shrink-0 w-12 text-center leading-none"
                    style={{ color: step.color }}
                  >
                    {step.n}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                  <div
                    className="ml-auto h-10 w-10 rounded-xl grid place-items-center shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0"
                    style={{ background: `${step.color}20`, color: step.color }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
              style={{ background: "var(--accent)", color: "var(--primary)" }}>
              <Trophy className="h-3 w-3" /> Student success stories
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold font-heading mb-4">
              Toppers <span className="text-gradient">love AcePrep</span>
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t, i) => (
              <FadeIn key={t.name} delay={i * 100}>
                <div className="card-light p-6 rounded-2xl h-full flex flex-col gap-4 hover:-translate-y-1 transition-transform duration-200">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-primary grid place-items-center text-lg">
                      {t.emoji}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.exam}</div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Highlights ── */}
      <section className="py-12 px-5" style={{ background: "var(--accent)" }}>
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <div className="card-light rounded-2xl p-8 text-center">
              <h3 className="text-xl font-bold mb-6">Everything included. Always free.</h3>
              <div className="grid sm:grid-cols-2 gap-3 text-sm text-left">
                {[
                  "AI Tutor — unlimited questions",
                  "Mock Tests with full analytics",
                  "Smart Flashcard system",
                  "Syllabus Tracker with AI topics",
                  "Study Planner auto-generated",
                  "PYQ Bank with AI explanations",
                  "Community with AI answers",
                  "Leaderboard with rank tiers",
                  "Focus Timer (Pomodoro)",
                  "Teaching Mode — Socratic AI",
                  "Deep Analytics & Diagnostics",
                  "Dark / Light / System theme",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-28 px-5 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-0 right-0 bottom-0 opacity-30"
            style={{ background: "radial-gradient(ellipse at center, rgba(139,92,246,0.25) 0%, transparent 70%)" }}
          />
        </div>

        <FadeIn className="relative max-w-2xl mx-auto text-center">
          <div className="text-6xl mb-6">🚀</div>
          <h2 className="text-4xl sm:text-5xl font-extrabold font-heading mb-4">
            Your rank is waiting.
            <br />
            <span className="text-gradient">Start today.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-10">
            Join thousands of students using AcePrep to crack JEE, NEET, UPSC and more.
            Sign in with Google — it takes 10 seconds.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-bold text-lg hover:opacity-90 transition-all hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Flame className="h-5 w-5" /> Get Started Free
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-5">No credit card. No download. Free forever.</p>
        </FadeIn>
      </section>

      {/* ── Footer ── */}
      <footer
        className="border-t py-8 px-5"
        style={{ borderColor: "var(--border)", background: "var(--accent)" }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-primary grid place-items-center">
              <GraduationCap className="h-3 w-3 text-white" />
            </div>
            <span className="font-bold text-sm">AcePrep</span>
          </div>
          <div className="text-xs text-muted-foreground text-center">
            AI-powered exam prep · Built for serious students
          </div>
          <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Sign in →
          </Link>
        </div>
      </footer>
    </div>
  );
}
