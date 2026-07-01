import { supabase } from "./supabase";
import {
  Subject,
  SavedQuiz,
  PlanItem,
  Note,
  UserProfile,
  MockTest,
  PerformanceLog,
  ChatSession,
  ReviewCard,
  FocusSession,
  UserStats,
  sm2,
  xpToLevel,
  BADGE_DEFS,
} from "./storage";

export const api = {
  // Subjects
  getSubjects: async () => {
    const { data, error } = await supabase.from("subjects").select("*");
    if (error) throw error;
    return (data as Subject[]) || [];
  },
  saveSubject: async (subject: Subject) => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("subjects")
      .upsert({ ...subject, user_id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  deleteSubject: async (id: string) => {
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) throw error;
  },

  // Quizzes
  getQuizzes: async () => {
    const { data, error } = await supabase
      .from("quizzes")
      .select("*")
      .order("createdAt", { ascending: false });
    if (error) throw error;
    return (data as SavedQuiz[]) || [];
  },
  saveQuiz: async (quiz: SavedQuiz) => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("quizzes")
      .upsert({ ...quiz, user_id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  deleteQuiz: async (id: string) => {
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) throw error;
  },

  // Plan Items
  getPlan: async () => {
    const { data, error } = await supabase.from("plan_items").select("*");
    if (error) throw error;
    return (data as PlanItem[]) || [];
  },
  savePlanItems: async (items: PlanItem[]) => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const mapped = items.map((item) => ({ ...item, user_id }));
    const { data, error } = await supabase.from("plan_items").upsert(mapped).select();
    if (error) throw error;
    return data;
  },
  updatePlanItem: async (id: string, done: boolean) => {
    const { data, error } = await supabase
      .from("plan_items")
      .update({ done })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  deletePlanItem: async (id: string) => {
    const { error } = await supabase.from("plan_items").delete().eq("id", id);
    if (error) throw error;
  },

  // Notes
  getNotes: async () => {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("createdAt", { ascending: false });
    if (error) throw error;
    return (data as Note[]) || [];
  },
  saveNote: async (note: Note) => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("notes")
      .upsert({ ...note, user_id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  deleteNote: async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) throw error;
  },

  // User Profile
  getUserProfile: async (): Promise<UserProfile | null> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) return null;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();
    if (error) throw error;
    return data as UserProfile | null;
  },
  saveUserProfile: async (profile: Partial<UserProfile>): Promise<UserProfile> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("user_profiles")
      .upsert({ ...profile, user_id }, { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw error;
    return data as UserProfile;
  },

  // Mock Tests
  getMockTests: async (): Promise<MockTest[]> => {
    const { data, error } = await supabase
      .from("mock_tests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as MockTest[]) || [];
  },
  saveMockTest: async (test: MockTest): Promise<MockTest> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("mock_tests")
      .upsert({ ...test, user_id })
      .select()
      .single();
    if (error) throw error;
    return data as MockTest;
  },
  deleteMockTest: async (id: string): Promise<void> => {
    const { error } = await supabase.from("mock_tests").delete().eq("id", id);
    if (error) throw error;
  },

  // Performance Logs
  getPerformanceLogs: async (): Promise<PerformanceLog[]> => {
    const { data, error } = await supabase
      .from("performance_logs")
      .select("*")
      .order("last_attempted", { ascending: false });
    if (error) throw error;
    return (data as PerformanceLog[]) || [];
  },
  upsertPerformanceLog: async (log: Partial<PerformanceLog>): Promise<PerformanceLog> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("performance_logs")
      .upsert(
        { ...log, user_id, last_attempted: new Date().toISOString() },
        { onConflict: "user_id,subject,topic" },
      )
      .select()
      .single();
    if (error) throw error;
    return data as PerformanceLog;
  },

  // Chat Sessions
  getChatSessions: async (): Promise<ChatSession[]> => {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data as ChatSession[]) || [];
  },
  saveChatSession: async (session: ChatSession): Promise<ChatSession> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("chat_sessions")
      .upsert({ ...session, user_id, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data as ChatSession;
  },
  deleteChatSession: async (id: string): Promise<void> => {
    const { error } = await supabase.from("chat_sessions").delete().eq("id", id);
    if (error) throw error;
  },

  // ── Review Cards (Spaced Repetition) ──────────────────────────────
  getReviewCards: async (): Promise<ReviewCard[]> => {
    const { data, error } = await supabase
      .from("review_cards")
      .select("*")
      .order("next_review", { ascending: true });
    if (error) throw error;
    return (data as ReviewCard[]) || [];
  },
  getDueReviewCards: async (): Promise<ReviewCard[]> => {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("review_cards")
      .select("*")
      .lte("next_review", today)
      .order("next_review", { ascending: true });
    if (error) throw error;
    return (data as ReviewCard[]) || [];
  },
  saveReviewCard: async (card: Omit<ReviewCard, "id" | "user_id">): Promise<ReviewCard> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");
    const { uid } = await import("./storage");
    const { data, error } = await supabase
      .from("review_cards")
      .insert({ ...card, id: uid(), user_id })
      .select()
      .single();
    if (error) throw error;
    return data as ReviewCard;
  },
  saveReviewCards: async (cards: Omit<ReviewCard, "id" | "user_id">[]): Promise<void> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");
    const { uid } = await import("./storage");
    const rows = cards.map((c) => ({ ...c, id: uid(), user_id }));
    const { error } = await supabase.from("review_cards").insert(rows);
    if (error) throw error;
  },
  updateReviewCard: async (id: string, rating: 0 | 1 | 3 | 5): Promise<ReviewCard> => {
    // First fetch the current card to apply SM-2
    const { data: current, error: fetchErr } = await supabase
      .from("review_cards")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr) throw fetchErr;
    const updates = sm2(current as ReviewCard, rating);
    const { data, error } = await supabase
      .from("review_cards")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as ReviewCard;
  },
  deleteReviewCard: async (id: string): Promise<void> => {
    const { error } = await supabase.from("review_cards").delete().eq("id", id);
    if (error) throw error;
  },

  // ── Focus Sessions (Pomodoro) ──────────────────────────────────────
  getFocusSessions: async (): Promise<FocusSession[]> => {
    const { data, error } = await supabase
      .from("focus_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data as FocusSession[]) || [];
  },
  saveFocusSession: async (session: Omit<FocusSession, "id" | "user_id">): Promise<FocusSession> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");
    const { uid } = await import("./storage");
    const { data, error } = await supabase
      .from("focus_sessions")
      .insert({ ...session, id: uid(), user_id })
      .select()
      .single();
    if (error) throw error;
    return data as FocusSession;
  },

  // ── Gamification (XP, Streaks, Badges, Leaderboard) ───────────────
  getUserStats: async (): Promise<UserStats | null> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) return null;
    const { data } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();
    return (data as UserStats) || null;
  },

  /**
   * Award XP for an action. Handles:
   * - Creating the row on first call
   * - Streak updates (consecutive daily activity)
   * - Level-up calculation
   * - Badge unlocks
   * Returns the updated stats + any newly unlocked badges.
   */
  awardXP: async (
    amount: number,
    context?: { mockCount?: number; focusCount?: number; reviewCount?: number; quizPerfect?: boolean },
  ): Promise<{ stats: UserStats; newBadges: string[] }> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const today = new Date().toISOString().split("T")[0];
    const hour = new Date().getHours();

    // Fetch or create current stats
    let { data: existing } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    const { uid } = await import("./storage");
    if (!existing) {
      const { data: created } = await supabase
        .from("user_stats")
        .insert({ id: uid(), user_id, xp: 0, level: 1, current_streak: 0, longest_streak: 0, badges: [] })
        .select()
        .single();
      existing = created;
    }

    const cur = existing as UserStats;

    // Streak logic
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split("T")[0];
    let newStreak = cur.current_streak;
    if (cur.last_active_date === today) {
      newStreak = cur.current_streak; // already active today
    } else if (cur.last_active_date === yStr) {
      newStreak = cur.current_streak + 1; // consecutive!
    } else {
      newStreak = 1; // streak broken
    }
    const longestStreak = Math.max(cur.longest_streak, newStreak);

    // New XP and level
    const newXp = cur.xp + amount;
    const newLevel = xpToLevel(newXp);

    // Badge evaluation
    const earned = new Set<string>(cur.badges);
    const newBadges: string[] = [];

    const checkBadge = (id: string, condition: boolean) => {
      if (condition && !earned.has(id)) { earned.add(id); newBadges.push(id); }
    };

    checkBadge("century",     newXp >= 100);
    checkBadge("on_fire",     newStreak >= 7);
    checkBadge("scholar",     newStreak >= 30);
    checkBadge("quiz_master", !!context?.quizPerfect);
    checkBadge("mock_warrior", (context?.mockCount ?? 0) >= 5);
    checkBadge("grinder",     (context?.focusCount ?? 0) >= 10);
    checkBadge("reviewer",    (context?.reviewCount ?? 0) >= 50);
    checkBadge("night_owl",   hour >= 0 && hour < 4);
    if (cur.badges.includes("first_steps") || cur.xp > 0) checkBadge("first_steps", true);

    const updates = {
      xp: newXp,
      level: newLevel,
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_active_date: today,
      badges: [...earned],
    };

    const { data: updated, error } = await supabase
      .from("user_stats")
      .update(updates)
      .eq("user_id", user_id)
      .select()
      .single();
    if (error) throw error;

    return { stats: updated as UserStats, newBadges };
  },

  getLeaderboard: async (): Promise<(UserStats & { display_name?: string })[]> => {
    const { data, error } = await supabase
      .from("user_stats")
      .select("*")
      .order("xp", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data as UserStats[]) || [];
  },
};

