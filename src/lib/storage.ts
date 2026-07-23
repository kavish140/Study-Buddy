import { useEffect, useRef, useState } from "react";
import { todayIST } from "./date-utils";

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);
  const prevKey = useRef(key);

  // Load from localStorage after mount (avoids SSR/hydration mismatch).
  // Also re-reads when the key changes to avoid writing stale data.
  useEffect(() => {
    // If the key changed, reset hydration so the write effect waits
    // until we've read the correct value for the new key.
    if (prevKey.current !== key) {
      hydrated.current = false;
      prevKey.current = key;
    }
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
      } else if (prevKey.current === key && !hydrated.current) {
        // New key with no stored value — reset to initial
        setValue(initial);
      }
    } catch {
      // Ignore localStorage errors (e.g. private browsing mode)
    }
    hydrated.current = true;
  }, [key, initial]);

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
  /** User's chosen display name (shown in sidebar and leaderboard) */
  display_name?: string;
  /** Emoji avatar selected in Settings (e.g. "🎓") */
  avatar_emoji?: string;
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
    // Failed — reset repetition count and interval
    repetitions = 0;
    interval_days = 1;
  } else {
    if (repetitions === 0) interval_days = 1;
    else if (repetitions === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * ease_factor);

    repetitions += 1;
  }

  // SM-2 spec: ease factor is adjusted on EVERY review, including failures.
  // On failure (rating < 3) this decreases EF so the card surfaces more frequently.
  ease_factor = Math.max(1.3, ease_factor + 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));

  // Pin to IST midnight (+05:30) to match the date-utils.ts convention and avoid
  // off-by-one for users in timezones ahead of IST.
  const next = new Date(todayIST() + "T00:00:00+05:30");
  next.setDate(next.getDate() + interval_days);
  const next_review = next.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

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
  // Max level reached — show 100% progress
  if (idx + 1 >= LEVEL_THRESHOLDS.length) {
    return { current: 0, needed: 1, pct: 100 };
  }
  const current = xp - (LEVEL_THRESHOLDS[idx] ?? 0);
  const needed = LEVEL_THRESHOLDS[idx + 1] - (LEVEL_THRESHOLDS[idx] ?? 0);
  return { current, needed, pct: Math.min(100, Math.round((current / needed) * 100)) };
}

/* ─── Rank Tier System ───────────────────────────────────────────────────── */

export type Tier = {
  name: string;
  /** Minimum XP to reach this tier */
  minXP: number;
  /** Emoji shown as the tier badge */
  emoji: string;
  /** CSS color value for the tier accent */
  color: string;
  /** Subtle background tint */
  bg: string;
};

/**
 * Ordered from lowest to highest.
 * Grandmaster has no upper XP bound.
 */
export const TIERS: Tier[] = [
  { name: "Bronze", minXP: 0, emoji: "🥉", color: "#cd7f32", bg: "rgba(205,127,50,0.12)" },
  { name: "Iron", minXP: 200, emoji: "⚙️", color: "#71717a", bg: "rgba(113,113,122,0.12)" },
  { name: "Silver", minXP: 500, emoji: "🥈", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  { name: "Gold", minXP: 1000, emoji: "🥇", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  { name: "Platinum", minXP: 2000, emoji: "💎", color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  { name: "Diamond", minXP: 3500, emoji: "💠", color: "#818cf8", bg: "rgba(129,140,248,0.12)" },
  { name: "Master", minXP: 5500, emoji: "👑", color: "#f43f5e", bg: "rgba(244,63,94,0.12)" },
  { name: "Grandmaster", minXP: 8000, emoji: "🌟", color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
];

export type TierInfo = {
  tier: Tier;
  nextTier: Tier | null;
  /** XP earned within the current tier range */
  currentTierXP: number;
  /** XP needed to complete the current tier range */
  tierRangeXP: number;
  /** Progress percentage within current tier (0–100) */
  pct: number;
};

/** Returns tier info for a given XP value. */
export function getTier(xp: number): TierInfo {
  // Find the highest tier the user qualifies for
  let tierIdx = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (xp >= TIERS[i].minXP) {
      tierIdx = i;
      break;
    }
  }
  const tier = TIERS[tierIdx];
  const nextTier = TIERS[tierIdx + 1] ?? null;

  if (!nextTier) {
    // Grandmaster — already at max
    return { tier, nextTier: null, currentTierXP: 0, tierRangeXP: 1, pct: 100 };
  }

  const currentTierXP = xp - tier.minXP;
  const tierRangeXP = nextTier.minXP - tier.minXP;
  const pct = Math.min(100, Math.round((currentTierXP / tierRangeXP) * 100));

  return { tier, nextTier, currentTierXP, tierRangeXP, pct };
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
  user_id?: string;
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
  /** True for AI-generated cached replies (used by community Ask AI caching) */
  is_ai?: boolean;
  created_at?: string;
};
