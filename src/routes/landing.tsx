import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Flame,
  FlipHorizontal2,
  LayoutDashboard,
  Library,
  Menu,
  MessageCircle,
  Sparkles,
  Target,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { EXAM_CATALOG } from "@/lib/exam-catalog";
import { StudyBuddyMark } from "@/components/StudyBuddyMark";
import "./landing.css";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "Study Buddy — Your complete study toolkit" },
      {
        name: "description",
        content:
          "Plan, learn, practice and improve with Study Buddy. Explore AI tutoring, syllabus tracking, study plans, notes, JEE and NEET practice, spaced repetition, focus sessions and analytics.",
      },
    ],
  }),
  component: LandingPage,
});

const FEATURE_GROUPS = [
  {
    id: "plan",
    label: "01 / GET ORGANIZED",
    title: "Give your preparation a plan.",
    description:
      "Turn a long syllabus into a clear next step. Keep your goals, topics and daily tasks together.",
    features: [
      {
        icon: LayoutDashboard,
        title: "Personal dashboard",
        description:
          "See syllabus progress, today's tasks, due review cards and your exam countdown in one place.",
      },
      {
        icon: BookOpen,
        title: "Syllabus tracker",
        description:
          "Track topics by subject, mark them complete and use AI to parse your own syllabus.",
      },
      {
        icon: Calendar,
        title: "Study planner",
        description:
          "Build a multi-day schedule from unfinished topics, or add and check off your own dated tasks.",
      },
    ],
  },
  {
    id: "learn",
    label: "02 / BUILD UNDERSTANDING",
    title: "Make the difficult bits click.",
    description: "Work through a doubt, condense a topic, then explain it in your own words.",
    features: [
      {
        icon: Sparkles,
        title: "AI Tutor",
        description:
          "Get step-by-step explanations, paste or upload images, attach PDFs up to 7.5 MB and revisit saved chats.",
      },
      {
        icon: FileText,
        title: "Notes & flashcards",
        description:
          "Create AI topic summaries and save notes alongside matching flashcards from the available question bank.",
      },
      {
        icon: Brain,
        title: "Teaching Mode",
        description:
          "Explain a concept to the AI. Get feedback on gaps, strengths and how clearly you understand it.",
      },
    ],
  },
  {
    id: "practice",
    label: "03 / PUT IT INTO PRACTICE",
    title: "Practice. Review. Remember.",
    description:
      "Use sourced JEE and NEET questions and answer keys, then bring mistakes back into your revision routine.",
    features: [
      {
        icon: Library,
        title: "Question bank & PYQs",
        description:
          "Explore imported JEE Main and Advanced questions, filter the bank and ask AI to explain a question.",
      },
      {
        icon: Target,
        title: "Practice quizzes",
        description:
          "Choose a topic and test your understanding with existing bank questions. Revisit results and explanations.",
      },
      {
        icon: Timer,
        title: "Timed mock tests",
        description:
          "Practice under time pressure with bank-based tests, scoring, answer review and saved attempts.",
      },
      {
        icon: FlipHorizontal2,
        title: "Smart Review",
        description:
          "Revise with spaced repetition, add your own cards and review mistakes saved from quizzes and mocks.",
      },
    ],
  },
  {
    id: "grow",
    label: "04 / KEEP MOVING FORWARD",
    title: "Build a habit you can see.",
    description: "Stay focused, find your weak spots and make preparation a little less solitary.",
    features: [
      {
        icon: Flame,
        title: "Focus Timer",
        description:
          "Set custom Pomodoro and break durations, track study sessions and keep the timer running as you navigate.",
      },
      {
        icon: BarChart3,
        title: "Performance analytics",
        description:
          "Explore accuracy, subject strengths, weak areas and study activity. Start with a question-bank diagnostic.",
      },
      {
        icon: MessageCircle,
        title: "Study community",
        description:
          "Post doubts, reply to peers, upvote discussions, accept helpful answers and request AI explanations.",
      },
      {
        icon: Trophy,
        title: "XP, streaks & leaderboard",
        description:
          "Earn XP through study activities, build your streak, unlock badges and see your position on the leaderboard.",
      },
    ],
  },
];

const PREVIEWS = [
  {
    label: "Plan",
    icon: Calendar,
    heading: "A little structure. A clearer day.",
    subheading: "Illustrative study plan",
    rows: [
      "Review electrostatics notes",
      "Practice integration questions",
      "Explain chemical equilibrium",
    ],
    foot: "Your syllabus → your daily study plan",
    badge: "One topic at a time",
  },
  {
    label: "Learn",
    icon: Sparkles,
    heading: "Stuck on a concept? Start here.",
    subheading: "Example AI Tutor conversation",
    rows: [
      "You: Help me understand integration by parts.",
      "Tutor: Start with the product rule for derivatives.",
      "Attach a question image or PDF for context.",
    ],
    foot: "Text, images and PDFs in one conversation",
    badge: "Understand the why",
  },
  {
    label: "Review",
    icon: FlipHorizontal2,
    heading: "Make revision part of the routine.",
    subheading: "Illustrative review session",
    rows: [
      "Bring back a missed quiz question",
      "Reveal the answer and explanation",
      "Rate recall to schedule the next review",
    ],
    foot: "Practice → feedback → spaced repetition",
    badge: "Build lasting recall",
  },
];

const FAQS = [
  {
    question: "Which exams can I prepare for?",
    answer:
      "Choose from the exam profiles on this page for syllabus-based planning and study tools. Imported, automatically graded questions cover JEE Main, JEE Advanced and a partial NEET UG collection. Other exams do not yet have in-app mock tests; external study resources are listed separately.",
  },
  {
    question: "Are the practice questions generated by AI?",
    answer:
      "Practice quizzes, mock tests and question-bank cards use existing imported questions and answer keys. AI supports explanations, notes, planning and teaching feedback. Sources and licenses are available on the public Sources page.",
  },
  {
    question: "Can I ask about a photo or PDF?",
    answer:
      "Yes. In AI Tutor, paste or upload a question image, or attach a PDF up to 7.5 MB. Add your question to explain what you need help understanding. Longer PDFs may be processed only in part.",
  },
  {
    question: "How do I get started?",
    answer:
      "Sign in with Google, choose your exam and subjects, and set up your profile. Then track your syllabus, build a study plan and start using the study tools.",
  },
];

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [preview, setPreview] = useState(0);
  const selected = PREVIEWS[preview];

  return (
    <div className="ace-landing">
      <a href="#main-content" className="ace-skip">
        Skip to content
      </a>
      <header className="ace-header">
        <div className="ace-container ace-nav">
          <a href="#" className="ace-brand" aria-label="Study Buddy home">
            <span className="ace-logo">
              <StudyBuddyMark className="h-full w-full" />
            </span>
            Study Buddy<span className="ace-brand-dot">.</span>
          </a>
          <nav className="ace-desktop-nav" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#exams">Exams</a>
            <a href="#faq">FAQs</a>
          </nav>
          <div className="ace-nav-actions">
            <Link to="/login" className="ace-signin">
              Sign in
            </Link>
            <Link to="/login" className="ace-button ace-button-small">
              Get started <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <button
              className="ace-menu-button"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-nav"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="landing-mobile-nav" className="ace-mobile-nav" aria-label="Mobile navigation">
            {[
              ["Features", "features"],
              ["How it works", "how-it-works"],
              ["Exams", "exams"],
              ["FAQs", "faq"],
            ].map(([label, id]) => (
              <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
          </nav>
        )}
      </header>
      <main id="main-content">
        <section className="ace-hero ace-container">
          <div className="ace-hero-copy">
            <div className="ace-eyebrow">
              <span className="ace-status-dot" /> YOUR AMBITION. YOUR STUDY SPACE.
            </div>
            <h1>
              Big exam goals.
              <br />
              Meet your <span>everyday edge.</span>
            </h1>
            <p>
              From “where do I start?” to “I get it.” Plan your prep, learn with AI, practice with
              purpose and see your progress — all in Study Buddy.
            </p>
            <div className="ace-hero-actions">
              <Link to="/login" className="ace-button">
                Build your study routine <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <a href="#features" className="ace-text-link">
                Explore every feature <ChevronDown size={16} aria-hidden="true" />
              </a>
            </div>
            <div className="ace-hero-notes">
              <span>
                <Check size={14} /> Google sign-in
              </span>
              <span>
                <Check size={14} /> No download needed
              </span>
            </div>
          </div>
          <div className="ace-preview-wrap">
            <div className="ace-preview" aria-label="Study tools preview">
              <div className="ace-preview-top">
                <span>
                  <span className="ace-tiny-logo">
                    <StudyBuddyMark className="h-full w-full" />
                  </span>{" "}
                  Your study workspace
                </span>
                <span className="ace-demo-label">DEMO</span>
              </div>
              <div className="ace-preview-tabs" role="group" aria-label="Choose a product preview">
                {PREVIEWS.map(({ label, icon: Icon }, index) => (
                  <button
                    key={label}
                    aria-pressed={preview === index}
                    onClick={() => setPreview(index)}
                  >
                    <Icon size={15} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
              <div className="ace-preview-body" aria-live="polite">
                <p className="ace-preview-caption">{selected.subheading}</p>
                <h2>{selected.heading}</h2>
                <div className="ace-preview-rows">
                  {selected.rows.map((row, index) => (
                    <div key={row}>
                      <span className={`ace-row-marker ${index === 0 ? "is-done" : ""}`}>
                        {index === 0 ? <Check size={13} /> : `0${index + 1}`}
                      </span>
                      <span>{row}</span>
                    </div>
                  ))}
                </div>
                <div className="ace-preview-foot">
                  <span>
                    <Flame size={15} /> {selected.foot}
                  </span>
                </div>
              </div>
            </div>
            <div className="ace-preview-sticker">
              <span>
                <Sparkles size={19} />
              </span>
              <div>
                <strong>{selected.badge}</strong>
                <small>A toolkit for your next step.</small>
              </div>
            </div>
          </div>
        </section>
        <div className="ace-workflow-strip">
          <div className="ace-container">
            <span>ONE CONNECTED STUDY ROUTINE</span>
            <div>
              {[
                "Plan your day",
                "Understand concepts",
                "Practice & revise",
                "Track your growth",
              ].map((step, i) => (
                <span key={step}>
                  <span className="ace-step-dot">0{i + 1}</span>
                  {step}
                  {i < 3 && <ArrowRight size={16} className="ace-strip-arrow" />}
                </span>
              ))}
            </div>
          </div>
        </div>
        <section id="features" className="ace-section ace-container">
          <div className="ace-section-heading">
            <div className="ace-eyebrow">THE COMPLETE TOOLKIT</div>
            <h2>
              Everything your preparation needs.
              <br />
              <span>Right where you need it.</span>
            </h2>
            <p>Four parts of a better study routine. Explore the tools that bring them together.</p>
          </div>
          <nav className="ace-feature-jumps" aria-label="Feature categories">
            {FEATURE_GROUPS.map((group) => (
              <a key={group.id} href={`#${group.id}`}>
                {group.id === "grow"
                  ? "Focus & grow"
                  : group.id === "learn"
                    ? "Learn & understand"
                    : group.id === "practice"
                      ? "Practice & revise"
                      : "Plan & organize"}
                <ArrowRight size={14} />
              </a>
            ))}
          </nav>
          <div className="ace-feature-groups">
            {FEATURE_GROUPS.map((group) => (
              <div
                key={group.id}
                id={group.id}
                className={`ace-feature-group ace-group-${group.id}`}
              >
                <div className="ace-group-heading">
                  <span className="ace-eyebrow">{group.label}</span>
                  <h3>{group.title}</h3>
                  <p>{group.description}</p>
                </div>
                <div className="ace-feature-grid">
                  {group.features.map(({ icon: Icon, title, description }) => (
                    <article className="ace-feature" key={title}>
                      <span className="ace-feature-icon">
                        <Icon size={21} aria-hidden="true" />
                      </span>
                      <h4>{title}</h4>
                      <p>{description}</p>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="ace-extra">
            <CheckCircle2 size={20} aria-hidden="true" />
            <p>
              <strong>Make the workspace yours.</strong> Exam and subject preferences, light and
              dark themes, saved study activity and a guided app tour help you settle into your
              routine.
            </p>
          </div>
        </section>
        <section id="how-it-works" className="ace-how">
          <div className="ace-container">
            <div className="ace-section-heading">
              <div className="ace-eyebrow">A SIMPLE WAY TO START</div>
              <h2>
                Your next study session,
                <br />
                <span>with a little more direction.</span>
              </h2>
            </div>
            <div className="ace-how-grid">
              {[
                {
                  title: "Set your direction",
                  text: "Sign in, choose your exam and subjects, and set your target date. Your dashboard brings the goal into view.",
                },
                {
                  title: "Make a plan. Start small.",
                  text: "Track your syllabus, schedule unfinished topics and use a focus session to work through the next one.",
                },
                {
                  title: "Close the learning loop",
                  text: "Get an explanation, practice available questions, review mistakes and use analytics to decide what comes next.",
                },
              ].map((step, i) => (
                <article key={step.title}>
                  <span>0{i + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="exams" className="ace-section ace-container ace-exams">
          <div>
            <div className="ace-eyebrow">BUILT AROUND YOUR GOAL</div>
            <h2>
              Your exam.
              <br />
              <span>Your starting point.</span>
            </h2>
            <p>
              Choose an exam profile to shape your syllabus and study plan. Bring your own topics
              into the workflow, too.
            </p>
            <Link to="/sources" className="ace-text-link">
              Explore study resources & sources <ArrowRight size={16} />
            </Link>
          </div>
          <div>
            <div className="ace-exam-grid">
              {EXAM_CATALOG.map((exam) => (
                <div key={exam.id}>
                  <span aria-hidden="true">{exam.icon}</span>
                  <strong>{exam.shortName}</strong>
                  {["jee-main", "jee-advanced", "neet"].includes(exam.id) && (
                    <small>In-app question bank</small>
                  )}
                </div>
              ))}
            </div>
            <p className="ace-exam-note">
              <Library size={17} aria-hidden="true" />
              <span>
                In-app quizzes, mocks and sourced practice cover JEE and a partial NEET UG bank.
                External resources for NEET UG, UPSC Prelims, SAT and GRE are available separately.
              </span>
            </p>
          </div>
        </section>
        <section id="faq" className="ace-section ace-container ace-faq">
          <div>
            <div className="ace-eyebrow">A FEW USEFUL DETAILS</div>
            <h2>
              Before you
              <br />
              <span>dive in.</span>
            </h2>
          </div>
          <div>
            {FAQS.map((faq) => (
              <details key={faq.question}>
                <summary>
                  {faq.question}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="ace-container ace-cta">
          <div className="ace-eyebrow">MAKE ROOM FOR PROGRESS</div>
          <h2>
            Your next chapter
            <br />
            starts with one session.
          </h2>
          <p>A plan for the day. Help when you’re stuck. A clear view of how far you’ve come.</p>
          <Link to="/login" className="ace-button">
            Get started with Study Buddy <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </main>
      <footer className="ace-footer ace-container">
        <a href="#" className="ace-brand">
          <span className="ace-logo">
            <StudyBuddyMark className="h-full w-full" />
          </span>
          Study Buddy.
        </a>
        <p>A little clarity. A little consistency. Your preparation, together.</p>
        <Link to="/login" className="ace-text-link">
          Sign in <ArrowRight size={15} />
        </Link>
      </footer>
    </div>
  );
}
