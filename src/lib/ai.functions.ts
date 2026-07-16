import { supabase } from "./supabase";

async function invokeEdgeFunction<T = Record<string, unknown>>(
  action: string,
  data: unknown,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Authentication required");

  let result;
  let error;
  try {
    const response = await supabase.functions.invoke("study-ai", {
      body: { action, data },
    });
    result = response.data;
    error = response.error;
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to reach AI service");
  }

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
  data: { topic: string; count: number; difficulty: string; examName?: string; source?: string };
}) => {
  return invokeEdgeFunction<{
    questions: { question: string; options: string[]; answerIndex: number; explanation: string }[];
  }>("generateQuiz", data);
};

export const generateNotes = async ({
  data,
}: {
  data: { topic: string; examName?: string; source?: string };
}) => {
  return invokeEdgeFunction<{ summary: string; flashcards: { q: string; a: string }[] }>(
    "generateNotes",
    data,
  );
};

export const parseSyllabus = async ({ data }: { data: { text: string; source?: string } }) => {
  return invokeEdgeFunction<{ subjects: { name: string; topics: string[] }[] }>(
    "parseSyllabus",
    data,
  );
};

export const generatePlan = async ({
  data,
}: {
  data: { topics: string[]; days: number; source?: string };
}) => {
  return invokeEdgeFunction<{ plan: { day: number; tasks: string[] }[] }>("generatePlan", data);
};

export const generateMockTest = async ({
  data,
}: {
  data: {
    examName: string;
    sections: { name: string; questions: number; topics: string[] }[];
    source?: string;
  };
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
  source,
  signal,
}: {
  imageBase64: string;
  mimeType: string;
  prompt?: string;
  examName?: string;
  source?: string;
  signal?: AbortSignal;
}): Promise<{ response: string }> {
  const { data: userData } = await supabase.auth.getSession();
  if (!userData?.session) throw new Error("Authentication required");

  let res;
  try {
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userData.session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ imageBase64, mimeType, prompt, examName, source }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new Error("Network error: Failed to reach AI service");
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "Image analysis failed");
  }

  const result = await res.json();
  if (result?.error) throw new Error(result.error);
  return result;
}

/**
 * Sends a PDF file directly to Gemini via the image-ai edge function.
 * Gemini natively reads scanned/image-based PDFs (up to ~1,000 pages) in one call.
 */
export async function solveFromPdf({
  file,
  prompt,
  examName,
  source,
  signal,
}: {
  file: File;
  prompt?: string;
  examName?: string;
  source?: string;
  signal?: AbortSignal;
}): Promise<{ response: string }> {
  const { data: userData } = await supabase.auth.getSession();
  if (!userData?.session) throw new Error("Authentication required");

  // Read the PDF as base64.
  // Use chunked String.fromCharCode to avoid call-stack overflow on large files.
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const pdfBase64 = btoa(binary);

  let res;
  try {
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userData.session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        imageBase64: pdfBase64,
        mimeType: "application/pdf",
        prompt,
        examName,
        source,
      }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new Error("Network error: Failed to reach AI service");
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "PDF analysis failed");
  }

  const result = await res.json();
  if (result?.error) throw new Error(result.error);
  return result;
}

export async function streamChat({
  messages,
  examName,
  source,
  signal,
  onChunk,
  onDone,
}: {
  messages: { role: string; content: string }[];
  examName?: string;
  source?: string;
  signal?: AbortSignal;
  onChunk: (text: string) => void;
  onDone: () => void;
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Authentication required");

  let res;
  try {
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action: "chat", data: { messages, examName, source } }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new Error("Network error: Failed to reach chat service");
  }

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

  // Process any remaining data left in the buffer after the stream ends
  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith("data: ") && trimmed.slice(6) !== "[DONE]") {
      try {
        const parsed = JSON.parse(trimmed.slice(6));
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onChunk(content);
      } catch {
        // Ignore malformed remnant
      }
    }
  }
  onDone();
}
