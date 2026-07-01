import { useEffect, useRef, useState } from "react";

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  // Load from localStorage after mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {}
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
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

export const uid = () => Math.random().toString(36).slice(2, 10);

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
  ease_factor: number;      // SM-2 ease factor, starts at 2.5
  interval_days: number;    // days until next review
  repetitions: number;      // times reviewed successfully
  next_review: string;      // ISO date string (YYYY-MM-DD)
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

  return { ease_factor, interval_days, repetitions, next_review, last_reviewed: new Date().toISOString() };
}
