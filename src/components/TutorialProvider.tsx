import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import type { ReactNode } from "react";

export interface TourStep {
  id: string;
  /** data-tour attribute value on the target element. Empty string = centered modal. */
  target: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

export interface Tour {
  id: string;
  name: string;
  steps: TourStep[];
}

/** ─── All Tours ─────────────────────────────────────────────────────── */
export const ALL_TOURS: Tour[] = [
  // ── Global app navigation tour ──────────────────────────────────────
  {
    id: "global",
    name: "App Tour",
    steps: [
      {
        id: "welcome",
        target: "",
        title: "Welcome to AcePrep! 👋",
        body: "Let's take a 90-second tour so you know exactly where everything is. You can skip anytime.",
        placement: "center",
      },
      {
        id: "nav-syllabus",
        target: "tour-nav-syllabus",
        title: "📚 Start with your Syllabus",
        body: "Click here to paste your exam syllabus. AI will parse it into organised subjects and topics automatically.",
        placement: "right",
      },
      {
        id: "nav-quiz",
        target: "tour-nav-quiz",
        title: "🧠 AI-Powered Quizzes",
        body: "Generate exam-pattern MCQs on any topic in seconds — complete with step-by-step solutions.",
        placement: "right",
      },
      {
        id: "nav-mock",
        target: "tour-nav-mock",
        title: "⏱ Full Mock Tests",
        body: "Simulate real exam conditions with timed full-length mock tests. Build speed and stamina.",
        placement: "right",
      },
      {
        id: "nav-review",
        target: "tour-nav-review",
        title: "🔁 Smart Review (Flashcards)",
        body: "Spaced-repetition cards that surface the right concept at the right time. Review your due cards daily!",
        placement: "right",
      },
      {
        id: "nav-chat",
        target: "tour-nav-chat",
        title: "✨ AI Tutor — 24/7",
        body: "Ask your AI tutor anything. Upload a photo of a problem and it solves it step-by-step.",
        placement: "right",
      },
      {
        id: "nav-analytics",
        target: "tour-nav-analytics",
        title: "📊 Track Your Progress",
        body: "See your accuracy, study time, and weak topics. Data-driven preparation always wins!",
        placement: "right",
      },
      {
        id: "nav-focus",
        target: "tour-nav-focus",
        title: "🔥 Focus Timer (Pomodoro)",
        body: "Study in focused 25-minute sprints with built-in breaks. Earn XP for completing sessions!",
        placement: "right",
      },
      {
        id: "help-btn",
        target: "tour-help-button",
        title: "You're all set! 🎓",
        body: "Click the '?' button anytime to restart this tour or get a guided tour of the current page.",
        placement: "top",
      },
    ],
  },
  // ── Syllabus page ────────────────────────────────────────────────────
  {
    id: "syllabus",
    name: "Syllabus Guide",
    steps: [
      {
        id: "syllabus-add",
        target: "tour-syllabus-add",
        title: "📋 Add Your Syllabus",
        body: 'Click "Add Subject" to start building your syllabus — or paste a full syllabus for AI to parse automatically.',
        placement: "bottom",
      },
      {
        id: "syllabus-progress",
        target: "tour-syllabus-progress",
        title: "✅ Track Completion",
        body: "Check off topics as you study them. Your overall completion percentage updates in real time.",
        placement: "bottom",
      },
    ],
  },
  // ── Quiz page ────────────────────────────────────────────────────────
  {
    id: "quiz",
    name: "Quiz Guide",
    steps: [
      {
        id: "quiz-topic",
        target: "tour-quiz-topic",
        title: "1️⃣ Enter a Topic",
        body: 'Type any topic from your syllabus — e.g. "Laws of Motion" or "Organic Chemistry". Be specific for better questions.',
        placement: "bottom",
      },
      {
        id: "quiz-settings",
        target: "tour-quiz-settings",
        title: "2️⃣ Configure Your Quiz",
        body: "Choose the number of questions and difficulty level. More questions = more thorough practice.",
        placement: "bottom",
      },
      {
        id: "quiz-generate",
        target: "tour-quiz-generate",
        title: "3️⃣ Generate & Attempt",
        body: 'Hit "Generate" — AI creates an exam-pattern quiz instantly. Review detailed solutions after each attempt.',
        placement: "bottom",
      },
    ],
  },
  // ── Mock Test page ───────────────────────────────────────────────────
  {
    id: "mock-test",
    name: "Mock Test Guide",
    steps: [
      {
        id: "mock-new",
        target: "tour-mock-new",
        title: "📝 Create a Mock Test",
        body: "Click here to set up a new timed mock test. Choose your exam pattern, subjects, and duration.",
        placement: "bottom",
      },
      {
        id: "mock-list",
        target: "tour-mock-list",
        title: "📋 Your Test History",
        body: "Completed tests appear here. Click any test to review your answers and get a detailed analysis.",
        placement: "top",
      },
    ],
  },
  // ── Smart Review page ────────────────────────────────────────────────
  {
    id: "review",
    name: "Smart Review Guide",
    steps: [
      {
        id: "review-cards",
        target: "tour-review-cards",
        title: "📇 Your Due Flashcards",
        body: "These cards are due for review today based on spaced-repetition. Daily review builds lasting memory!",
        placement: "bottom",
      },
      {
        id: "review-rate",
        target: "tour-review-rate",
        title: "⭐ Rate Your Recall",
        body: "After seeing the answer, rate how well you remembered it. The algorithm optimises your review schedule automatically.",
        placement: "top",
      },
    ],
  },
  // ── Focus Timer page ─────────────────────────────────────────────────
  {
    id: "focus",
    name: "Focus Timer Guide",
    steps: [
      {
        id: "focus-timer",
        target: "tour-focus-timer",
        title: "⏱ The Pomodoro Timer",
        body: "Study for 25 minutes, then take a 5-minute break. This rhythm keeps your brain sharp and prevents burnout.",
        placement: "bottom",
      },
      {
        id: "focus-start",
        target: "tour-focus-start",
        title: "▶️ Start Your Session",
        body: "Hit the play button to begin! XP is automatically awarded when you complete a focus session.",
        placement: "bottom",
      },
    ],
  },
  // ── AI Tutor (chat) page ─────────────────────────────────────────────
  {
    id: "chat",
    name: "AI Tutor Guide",
    steps: [
      {
        id: "chat-new",
        target: "tour-chat-new",
        title: "➕ Start a New Chat",
        body: "Click here to start a fresh conversation. Tip: mention your exam name for more targeted explanations!",
        placement: "right",
      },
      {
        id: "chat-input",
        target: "tour-chat-input",
        title: "✍️ Ask Anything",
        body: "Type your question here. You can also click the 📷 camera icon to upload a photo of a problem!",
        placement: "top",
      },
    ],
  },
  // ── PYQ Bank page ────────────────────────────────────────────────────
  {
    id: "pyq",
    name: "PYQ Bank Guide",
    steps: [
      {
        id: "pyq-generate",
        target: "tour-pyq-generate",
        title: "🔍 Generate PYQs",
        body: "Enter a topic and year range to fetch real previous-year questions. Practice with actual exam questions!",
        placement: "bottom",
      },
      {
        id: "pyq-results",
        target: "tour-pyq-results",
        title: "📖 Explore Questions",
        body: "Browse questions below. Click any to see the full solution and explanation.",
        placement: "top",
      },
    ],
  },
  // ── Planner page ─────────────────────────────────────────────────────
  {
    id: "planner",
    name: "Planner Guide",
    steps: [
      {
        id: "planner-generate",
        target: "tour-planner-generate",
        title: "🤖 AI Study Plan",
        body: "Click here to let AI generate a personalised multi-day study plan based on your syllabus and exam date.",
        placement: "bottom",
      },
      {
        id: "planner-tasks",
        target: "tour-planner-tasks",
        title: "📋 Your Daily Tasks",
        body: "Tick off tasks as you complete them each day. The planner helps you stay on track towards your exam.",
        placement: "top",
      },
    ],
  },
  // ── Notes page ───────────────────────────────────────────────────────
  {
    id: "notes",
    name: "Notes Guide",
    steps: [
      {
        id: "notes-topic",
        target: "tour-notes-topic",
        title: "📝 Enter a Topic",
        body: "Type any syllabus topic and hit Generate. AI will create a crisp summary and a set of flashcards for you!",
        placement: "bottom",
      },
      {
        id: "notes-flashcard",
        target: "tour-notes-flashcard",
        title: "🃏 Built-in Flashcards",
        body: "Every note comes with auto-generated flashcards. Tap a card to reveal the answer and test yourself.",
        placement: "top",
      },
    ],
  },
  // ── Analytics page ───────────────────────────────────────────────────
  {
    id: "analytics",
    name: "Analytics Guide",
    steps: [
      {
        id: "analytics-overview",
        target: "tour-analytics-overview",
        title: "📊 Performance Overview",
        body: "See your overall accuracy and XP over time. Use trends to identify which topics need more work.",
        placement: "bottom",
      },
      {
        id: "analytics-subjects",
        target: "tour-analytics-subjects",
        title: "📚 Subject Breakdown",
        body: "See which subjects are your weakest. Focus your study time where it will have the biggest impact.",
        placement: "bottom",
      },
    ],
  },
  // ── Community page ───────────────────────────────────────────────────
  {
    id: "community",
    name: "Community Guide",
    steps: [
      {
        id: "community-post",
        target: "tour-community-post",
        title: "📢 Join the Discussion",
        body: "Share doubts, post resources, or ask questions. Learning together is always faster!",
        placement: "bottom",
      },
    ],
  },
  // ── Leaderboard page ─────────────────────────────────────────────────
  {
    id: "leaderboard",
    name: "Leaderboard Guide",
    steps: [
      {
        id: "leaderboard-rank",
        target: "tour-leaderboard-rank",
        title: "🏆 Your Rank",
        body: "See how you rank! Earn XP by completing quizzes, mock tests, focus sessions, and daily study streaks.",
        placement: "bottom",
      },
    ],
  },
];

/** ─── Context ───────────────────────────────────────────────────────── */
interface TutorialCtx {
  activeTour: Tour | null;
  currentStepIndex: number;
  isActive: boolean;
  startTour: (tourId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completedTours: string[];
  /** Auto-starts tour if user hasn't seen it yet and no tour is running. */
  triggerPageTour: (tourId: string) => void;
}

const TutorialContext = createContext<TutorialCtx | null>(null);

const COMPLETED_KEY = "aceprep_tours_completed";

function loadCompleted(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COMPLETED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedTours, setCompletedTours] = useState<string[]>(loadCompleted);

  const activeTour = activeTourId ? (ALL_TOURS.find((t) => t.id === activeTourId) ?? null) : null;
  const isActive = !!activeTour;

  // Keep a ref so callbacks (nextStep etc.) always see the latest tour without re-creating
  const activeTourRef = useRef(activeTour);
  useEffect(() => { activeTourRef.current = activeTour; }, [activeTour]);

  const markCompleted = useCallback((tourId: string) => {
    setCompletedTours((prev) => {
      const next = [...new Set([...prev, tourId])];
      localStorage.setItem(COMPLETED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const startTour = useCallback((tourId: string) => {
    setActiveTourId(tourId);
    setCurrentStepIndex(0);
  }, []);

  const nextStep = useCallback(() => {
    const tour = activeTourRef.current;
    if (!tour) return;
    setCurrentStepIndex((i) => {
      if (i >= tour.steps.length - 1) {
        // Last step — end the tour
        markCompleted(tour.id);
        setActiveTourId(null);
        return 0;
      }
      return i + 1;
    });
  }, [markCompleted]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const skipTour = useCallback(() => {
    if (activeTourId) markCompleted(activeTourId);
    setActiveTourId(null);
    setCurrentStepIndex(0);
  }, [activeTourId, markCompleted]);

  const triggerPageTour = useCallback(
    (tourId: string) => {
      // Re-read from storage to ensure freshest state
      const completed = loadCompleted();
      if (!completed.includes(tourId) && !activeTourId) {
        // Small delay to let the page render first
        setTimeout(() => startTour(tourId), 700);
      }
    },
    [activeTourId, startTour],
  );

  return (
    <TutorialContext.Provider
      value={{
        activeTour,
        currentStepIndex,
        isActive,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        completedTours,
        triggerPageTour,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
}
