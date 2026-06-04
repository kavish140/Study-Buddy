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

export const generateMockTest = async ({ data }: { data: { examName: string; sections: { name: string; questions: number; topics: string[] }[] } }) => {
  return invokeEdgeFunction("generateMockTest", data);
};

export async function streamChat({
  messages,
  examName,
  onChunk,
  onDone,
}: {
  messages: { role: string; content: string }[];
  examName?: string;
  onChunk: (text: string) => void;
  onDone: () => void;
}) {
  const { data: userData } = await supabase.auth.getSession();
  if (!userData?.session) throw new Error("Authentication required");

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-ai`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userData.session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action: "chat", data: { messages, examName } }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "Chat request failed");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const jsonStr = trimmed.slice(6);
      if (jsonStr === "[DONE]") {
        onDone();
        return;
      }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onChunk(content);
      } catch {}
    }
  }
  onDone();
}
