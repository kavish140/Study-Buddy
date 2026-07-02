import { useEffect, useRef, useState } from "react";

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  // Load from localStorage after mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Ignore localStorage errors (e.g. private browsing mode)
    }
    hydrated.current = true;
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore localStorage errors (e.g. private browsing mode)
    }
  }, [key, value]);

  return [value, setValue] as const;
}

export type Topic = { id: string; name: string; done: boolean };
export type Subject = { id: string; name: string; color: string; topics: Topic[] };

export type QuizQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};
export type SavedQuiz = {
  id: string;
  topic: string;
  createdAt: number;
  score?: number;
  questions: QuizQuestion[];
};

export type PlanItem = { id: string; date: string; task: string; done: boolean };

export type Note = {
  id: string;
  topic: string;
  summary: string;
  flashcards: { q: string; a: string }[];
  createdAt: number;
};

export const uid = () => crypto.randomUUID();

export type UserProfile = {
  id?: string;
  user_id?: string;
  exam_id: string;
  exam_name: string;
  target_date: string | null;
  selected_subjects: string[];
  onboarding_completed: boolean;
  created_at?: string;
};

export type MockTestQuestion = {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  section: string;
  topic: string;
};

export type MockTestSection = {
  name: string;
  questions: MockTestQuestion[];
  timeMinutes: number;
};

export type MockTest = {
  id: string;
  user_id?: string;
  exam_id: string;
  exam_name: string;
  sections: MockTestSection[];
  answers: Record<string, number | null>;
  score?: number;
  total_marks?: number;
  time_taken_seconds?: number;
  total_time_seconds: number;
  status: "in_progress" | "completed";
  started_at?: string;
  completed_at?: string;
  created_at?: string;
};

export type PerformanceLog = {
  id?: string;
  user_id?: string;
  subject: string;
  topic: string;
  question_count: number;
  correct_count: number;
  last_attempted?: string;
  created_at?: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  /** Data URL for an image attached to this message (user-uploaded for OCR) */
  imageUrl?: string;
};

export type ChatSession = {
  id: string;
  user_id?: string;
  title: string;
  exam_id?: string;
  messages: ChatMessage[];
  created_at?: string;
  updated_at?: string;
};

export type ReviewCard = {
  id: string;
  user_id?: string;
  question: string;
  answer: string;
  explanation?: string;
  subject?: string;
  topic?: string;
  source?: "quiz" | "mock_test" | "flashcard" | "manual";
  ease_factor: number; // SM-2 ease factor, starts at 2.5
  interval_days: number; // days until next review
  repetitions: number; // times reviewed successfully
  next_review: string; // ISO date string (YYYY-MM-DD)
  last_reviewed?: string;
  created_at?: string;
};

export type FocusSession = {
  id: string;
  user_id?: string;
  subject?: string;
  topic?: string;
  duration_minutes: number;
  completed: boolean;
  started_at?: string;
  ended_at?: string;
};

/**
 * SM-2 Algorithm: compute next interval based on rating (0-5)
 * rating: 0=Again, 1=Hard, 3=Good, 5=Easy
 */
export function sm2(card: ReviewCard, rating: 0 | 1 | 3 | 5): Partial<ReviewCard> {
  let { ease_factor, interval_days, repetitions } = card;

  if (rating < 3) {
    // Failed — reset
    repetitions = 0;
    interval_days = 1;
  } else {
    if (repetitions === 0) interval_days = 1;
    else if (repetitions === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * ease_factor);

    ease_factor = Math.max(1.3, ease_factor + 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
    repetitions += 1;
  }

  const next = new Date();
  next.setDate(next.getDate() + interval_days);
  const next_review = next.toISOString().split("T")[0];

  return {
    ease_factor,
    interval_days,
    repetitions,
    next_review,
    last_reviewed: new Date().toISOString(),
  };
}

/* ─────────────────────────────────────────────────
   Gamification — XP, Levels, Streaks, Badges
───────────────────────────────────────────────── */

export type UserStats = {
  id: string;
  user_id?: string;
  xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_active_date?: string;
  badges: string[];
  created_at?: string;
};

/** XP awarded per action */
export const XP_REWARDS = {
  quiz_correct: 10, // per correct answer in a quiz
  mock_complete: 50, // complete a full mock test
  daily_login: 5, // first action of the day
  focus_session: 15, // complete a Pomodoro session
  review_card: 5, // rate a review card
  upload_doc: 20, // upload a PDF
} as const;

/** Level thresholds: level N requires this much total XP */
export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000, 6500];

export function xpToLevel(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export function xpForNextLevel(xp: number): { current: number; needed: number; pct: number } {
  const level = xpToLevel(xp);
  const idx = level - 1;
  const current = xp - (LEVEL_THRESHOLDS[idx] ?? 0);
  const needed =
    (LEVEL_THRESHOLDS[idx + 1] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) -
    (LEVEL_THRESHOLDS[idx] ?? 0);
  return { current, needed, pct: Math.min(100, Math.round((current / needed) * 100)) };
}

export type BadgeDef = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
};

export const BADGE_DEFS: BadgeDef[] = [
  {
    id: "first_steps",
    name: "First Steps",
    description: "Complete onboarding",
    emoji: "🎯",
    color: "text-blue-400",
  },
  {
    id: "quiz_master",
    name: "Quiz Master",
    description: "Score 100% on a quiz",
    emoji: "🧠",
    color: "text-purple-400",
  },
  {
    id: "mock_warrior",
    name: "Mock Warrior",
    description: "Complete 5 mock tests",
    emoji: "⚔️",
    color: "text-red-400",
  },
  {
    id: "on_fire",
    name: "On Fire",
    description: "Achieve a 7-day streak",
    emoji: "🔥",
    color: "text-amber-400",
  },
  {
    id: "scholar",
    name: "Scholar",
    description: "Achieve a 30-day streak",
    emoji: "📚",
    color: "text-emerald-400",
  },
  {
    id: "speed_demon",
    name: "Speed Demon",
    description: "Complete a mock test early",
    emoji: "⚡",
    color: "text-yellow-400",
  },
  {
    id: "night_owl",
    name: "Night Owl",
    description: "Study after midnight",
    emoji: "🦉",
    color: "text-indigo-400",
  },
  {
    id: "century",
    name: "Century",
    description: "Earn 100 XP",
    emoji: "💯",
    color: "text-cyan-400",
  },
  {
    id: "grinder",
    name: "Grinder",
    description: "Complete 10 focus sessions",
    emoji: "💪",
    color: "text-orange-400",
  },
  {
    id: "reviewer",
    name: "Card Shark",
    description: "Review 50 flashcards",
    emoji: "🃏",
    color: "text-pink-400",
  },
];

/* ─────────────────────────────────────────────────
   Phase 10 — PYQ Bank + Community Forums
───────────────────────────────────────────────── */

export type PYQQuestion = {
  id: string;
  exam_id: string;
  year: number;
  subject: string;
  topic: string;
  question: string;
  question_type: "mcq" | "integer" | "assertion";
  options?: string[];
  answer: string;
  explanation?: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
};

export type ForumPost = {
  id: string;
  user_id?: string;
  exam_id?: string;
  subject?: string;
  topic?: string;
  title: string;
  content: string;
  upvotes: number;
  reply_count: number;
  created_at?: string;
};

export type ForumReply = {
  id: string;
  post_id: string;
  user_id?: string;
  content: string;
  upvotes: number;
  is_accepted: boolean;
  created_at?: string;
};
