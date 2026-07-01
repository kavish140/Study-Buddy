import { supabase } from "./supabase";

async function invokeEdgeFunction<T = Record<string, unknown>>(
  action: string,
  data: unknown,
): Promise<T> {
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

export const generateQuiz = async ({
  data,
}: {
  data: { topic: string; count: number; difficulty: string; examName?: string };
}) => {
  return invokeEdgeFunction<{
    questions: { question: string; options: string[]; answerIndex: number; explanation: string }[];
  }>("generateQuiz", data);
};

export const generateNotes = async ({ data }: { data: { topic: string; examName?: string } }) => {
  return invokeEdgeFunction<{ summary: string; flashcards: { q: string; a: string }[] }>(
    "generateNotes",
    data,
  );
};

export const parseSyllabus = async ({ data }: { data: { text: string } }) => {
  return invokeEdgeFunction<{ subjects: { name: string; topics: string[] }[] }>(
    "parseSyllabus",
    data,
  );
};

export const generatePlan = async ({ data }: { data: { topics: string[]; days: number } }) => {
  return invokeEdgeFunction<{ plan: { day: number; tasks: string[] }[] }>("generatePlan", data);
};

export const generateMockTest = async ({
  data,
}: {
  data: { examName: string; sections: { name: string; questions: number; topics: string[] }[] };
}) => {
  return invokeEdgeFunction<{
    sections: {
      name: string;
      questions: {
        id?: string;
        question: string;
        options: string[];
        answerIndex: number;
        explanation: string;
        topic?: string;
      }[];
    }[];
  }>("generateMockTest", data);
};

export async function solveFromImage({
  imageBase64,
  mimeType,
  prompt,
  examName,
}: {
  imageBase64: string;
  mimeType: string;
  prompt?: string;
  examName?: string;
}): Promise<{ response: string }> {
  const { data: userData } = await supabase.auth.getSession();
  if (!userData?.session) throw new Error("Authentication required");

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userData.session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ imageBase64, mimeType, prompt, examName }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "Image analysis failed");
  }

  const result = await res.json();
  if (result?.error) throw new Error(result.error);
  return result;
}

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

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userData.session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action: "chat", data: { messages, examName } }),
  });

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
      } catch {
        // Ignore malformed SSE JSON chunks (partial data)
      }
    }
  }
  onDone();
}
