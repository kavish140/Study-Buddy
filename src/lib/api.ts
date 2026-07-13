import { supabase } from "./supabase";
import { todayIST, yesterdayIST, currentHourIST } from "./date-utils";
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
  PYQQuestion,
  ForumPost,
  ForumReply,
  sm2,
  xpToLevel,
  BADGE_DEFS,
  uid,
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
  // Clears all plan items for the current user — called before re-generating a plan
  // so that existing tasks are not accumulated on top of the new AI-generated ones.
  clearPlan: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");
    const { error } = await supabase.from("plan_items").delete().eq("user_id", user_id);
    if (error) throw error;
  },

  // Notes
  getNotes: async () => {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false });
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
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");
    const { error } = await supabase.from("notes").delete().eq("id", id).eq("user_id", user_id);
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
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) return [];

    const { data, error } = await supabase
      .from("mock_tests")
      .select("*")
      .eq("user_id", user_id)
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
    const today = todayIST();
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
  saveFocusSession: async (
    session: Omit<FocusSession, "id" | "user_id">,
  ): Promise<FocusSession> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

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
    context?: {
      mockCount?: number;
      focusCount?: number;
      reviewCount?: number;
      quizPerfect?: boolean;
    },
  ): Promise<{ stats: UserStats; newBadges: string[] }> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const today = todayIST();
    const hour = currentHourIST();

    // Fetch or create current stats
    let { data: existing } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!existing) {
      // Use upsert to prevent race condition when two tabs load simultaneously
      const { data: created } = await supabase
        .from("user_stats")
        .upsert(
          {
            id: uid(),
            user_id,
            xp: 0,
            level: 1,
            current_streak: 0,
            longest_streak: 0,
            badges: [],
          },
          { onConflict: "user_id", ignoreDuplicates: true },
        )
        .select()
        .maybeSingle();

      if (created) {
        existing = created;
      } else {
        // It was ignored due to race condition, fetch the actual created row
        const { data: refetched } = await supabase
          .from("user_stats")
          .select("*")
          .eq("user_id", user_id)
          .single();
        existing = refetched;
      }
    }

    const cur = existing as UserStats;

    // Streak logic
    const yStr = yesterdayIST();
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
      if (condition && !earned.has(id)) {
        earned.add(id);
        newBadges.push(id);
      }
    };

    checkBadge("century", newXp >= 100);
    checkBadge("on_fire", newStreak >= 7);
    checkBadge("scholar", newStreak >= 30);
    checkBadge("quiz_master", !!context?.quizPerfect);
    checkBadge("mock_warrior", (context?.mockCount ?? 0) >= 5);
    checkBadge("grinder", (context?.focusCount ?? 0) >= 10);
    checkBadge("reviewer", (context?.reviewCount ?? 0) >= 50);
    checkBadge("night_owl", hour >= 0 && hour < 4);
    // Award first_steps on first ever XP — checkBadge already prevents duplicates
    checkBadge("first_steps", true);

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

  getLeaderboard: async (): Promise<UserStats[]> => {
    const { data, error } = await supabase
      .from("user_stats")
      .select("*")
      .order("xp", { ascending: false })
      .limit(50);
    if (error) throw error;
    // Normalise rows so xp/level are never undefined (DB may have NULLs)
    return ((data as UserStats[]) || []).map((row) => ({
      ...row,
      xp: row.xp ?? 0,
      level: row.level ?? 1,
      current_streak: row.current_streak ?? 0,
      longest_streak: row.longest_streak ?? 0,
      badges: row.badges ?? [],
    }));
  },

  // ── PYQ Bank ─────────────────────────────────────────────────────
  getPYQQuestions: async (filters?: {
    exam_id?: string;
    year?: number;
    subject?: string;
    difficulty?: string;
    search?: string;
  }): Promise<PYQQuestion[]> => {
    let q = supabase.from("pyq_questions").select("*");
    if (filters?.exam_id) q = q.eq("exam_id", filters.exam_id);
    if (filters?.year) q = q.eq("year", filters.year);
    if (filters?.subject) q = q.eq("subject", filters.subject);
    if (filters?.difficulty) q = q.eq("difficulty", filters.difficulty);
    if (filters?.search) q = q.ilike("question", `%${filters.search}%`);
    const { data, error } = await q.order("year", { ascending: false }).limit(100);
    if (error) throw error;
    return (data as PYQQuestion[]) || [];
  },
  savePYQQuestion: async (q: Omit<PYQQuestion, "id">): Promise<PYQQuestion> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("pyq_questions")
      .insert({ ...q, id: uid(), user_id })
      .select()
      .single();
    if (error) throw error;
    return data as PYQQuestion;
  },
  savePYQQuestions: async (questions: Omit<PYQQuestion, "id">[]): Promise<void> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const rows = questions.map((q) => ({ ...q, id: uid(), user_id }));
    const { error } = await supabase.from("pyq_questions").insert(rows);
    if (error) throw error;
  },

  // ── Community Forum ──────────────────────────────────────────────
  getForumPosts: async (filters?: { exam_id?: string; subject?: string }): Promise<ForumPost[]> => {
    let q = supabase.from("forum_posts").select("*");
    if (filters?.exam_id) q = q.eq("exam_id", filters.exam_id);
    if (filters?.subject) q = q.eq("subject", filters.subject);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return (data as ForumPost[]) || [];
  },
  getForumPost: async (id: string): Promise<ForumPost | null> => {
    const { data, error } = await supabase
      .from("forum_posts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as ForumPost | null;
  },
  createForumPost: async (
    post: Pick<ForumPost, "title" | "content" | "exam_id" | "subject" | "topic">,
  ): Promise<ForumPost> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("forum_posts")
      .insert({ ...post, id: uid(), user_id, upvotes: 0, reply_count: 0 })
      .select()
      .single();
    if (error) throw error;
    return data as ForumPost;
  },
  upvotePost: async (id: string): Promise<void> => {
    await supabase.rpc("increment_post_upvotes", { post_id: id }).throwOnError();
  },
  getForumReplies: async (post_id: string): Promise<ForumReply[]> => {
    const { data, error } = await supabase
      .from("forum_replies")
      .select("*")
      .eq("post_id", post_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as ForumReply[]) || [];
  },
  createForumReply: async (post_id: string, content: string): Promise<ForumReply> => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("forum_replies")
      .insert({ id: uid(), post_id, user_id, content, upvotes: 0, is_accepted: false })
      .select()
      .single();
    if (error) throw error;
    // Use atomic RPC to avoid read-modify-write race when two users reply concurrently
    await supabase.rpc("increment_reply_count", { post_id }).throwOnError();
    return data as ForumReply;
  },
  acceptReply: async (reply_id: string): Promise<void> => {
    await supabase
      .from("forum_replies")
      .update({ is_accepted: true })
      .eq("id", reply_id)
      .throwOnError();
  },
};
