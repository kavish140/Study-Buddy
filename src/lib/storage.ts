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
