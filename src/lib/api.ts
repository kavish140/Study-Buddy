import { supabase } from "./supabase";
import { Subject, SavedQuiz, PlanItem, Note } from "./storage";

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
};
