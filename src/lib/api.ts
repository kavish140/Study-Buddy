import { supabase } from "./supabase";
import { Subject, SavedQuiz, PlanItem, Note, UserProfile, MockTest, PerformanceLog, ChatSession } from "./storage";

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
    
    const { data, error } = await supabase.from("subjects").upsert({ ...subject, user_id }).select().single();
    if (error) throw error;
    return data;
  },
  deleteSubject: async (id: string) => {
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) throw error;
  },

  // Quizzes
  getQuizzes: async () => {
    const { data, error } = await supabase.from("quizzes").select("*").order('createdAt', { ascending: false });
    if (error) throw error;
    return (data as SavedQuiz[]) || [];
  },
  saveQuiz: async (quiz: SavedQuiz) => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const { data, error } = await supabase.from("quizzes").upsert({ ...quiz, user_id }).select().single();
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

    const mapped = items.map(item => ({ ...item, user_id }));
    const { data, error } = await supabase.from("plan_items").upsert(mapped).select();
    if (error) throw error;
    return data;
  },
  updatePlanItem: async (id: string, done: boolean) => {
    const { data, error } = await supabase.from("plan_items").update({ done }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  deletePlanItem: async (id: string) => {
    const { error } = await supabase.from("plan_items").delete().eq("id", id);
    if (error) throw error;
  },

  // Notes
  getNotes: async () => {
    const { data, error } = await supabase.from("notes").select("*").order('createdAt', { ascending: false });
    if (error) throw error;
    return (data as Note[]) || [];
  },
  saveNote: async (note: Note) => {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) throw new Error("Not authenticated");

    const { data, error } = await supabase.from("notes").upsert({ ...note, user_id }).select().single();
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
        { onConflict: "user_id,subject,topic" }
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
};
