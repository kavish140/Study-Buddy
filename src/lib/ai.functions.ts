import { supabase } from "./supabase";

async function invokeEdgeFunction(action: string, data: any) {
  const { data: userData } = await supabase.auth.getSession();
  if (!userData?.session) throw new Error("Authentication required");

  const { data: result, error } = await supabase.functions.invoke("study-ai", {
    body: { action, data },
  });

  if (error) {
    throw new Error(error.message || "Failed to invoke AI function");
  }

  if (result?.error) {
    throw new Error(result.error);
  }

  return result;
}

export const generateQuiz = async ({ data }: { data: { topic: string; count: number; difficulty: string } }) => {
  return invokeEdgeFunction("generateQuiz", data);
};

export const generateNotes = async ({ data }: { data: { topic: string } }) => {
  return invokeEdgeFunction("generateNotes", data);
};

export const parseSyllabus = async ({ data }: { data: { text: string } }) => {
  return invokeEdgeFunction("parseSyllabus", data);
};

export const generatePlan = async ({ data }: { data: { topics: string[]; days: number } }) => {
  return invokeEdgeFunction("generatePlan", data);
};
