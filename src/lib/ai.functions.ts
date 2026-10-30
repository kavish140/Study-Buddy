import { supabase } from "./supabase";
import { backendFetch } from "./backend-request";
import { consumeChatStream, readAIJson } from "./ai-response";
import { validateAIResult } from "./ai-validation";
import { examIdFromName, filterBank, loadQuestionBank } from "./question-bank";

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
    if (error.context instanceof Response) await readAIJson(error.context);
    throw new Error(error.message || "Failed to invoke AI function");
  }

  if (result?.error) {
    throw new Error(result.error);
  }

  return validateAIResult(action, result) as T;
}

export const generateNotes = async ({
  data,
}: {
  data: { topic: string; examName?: string; source?: string; appContext?: string };
}) => {
  const notes = await invokeEdgeFunction<{ summary: string }>("generateNotes", data);
  const requestedExam = examIdFromName(data.examName || "JEE Main");
  const bank = await loadQuestionBank(requestedExam.startsWith("jee") ? "jee" : requestedExam);
  return {
    ...notes,
    flashcards: filterBank(bank, { search: data.topic })
      .slice(0, 6)
      .map((q) => ({
        q: `${q.question}${q.options.length ? `\n\n${q.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join("\n\n")}` : ""}`,
        a: `${q.answer}${q.explanation ? `\n\n${q.explanation}` : ""}\n\nSource: [${q.source.name}](${q.source.url})`,
      })),
  };
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
  data: { topics: string[]; days: number; source?: string; appContext?: string };
}) => {
  return invokeEdgeFunction<{ plan: { day: number; tasks: string[] }[] }>("generatePlan", data);
};

export async function solveFromImage({
  imageBase64,
  mimeType,
  prompt,
  examName,
  source,
  signal,
  appContext,
}: {
  imageBase64: string;
  mimeType: string;
  prompt?: string;
  examName?: string;
  source?: string;
  signal?: AbortSignal;
  appContext?: string;
}): Promise<{ response: string }> {
  const { data: userData } = await supabase.auth.getSession();
  if (!userData?.session) throw new Error("Authentication required");

  let res;
  try {
    res = await backendFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userData.session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ imageBase64, mimeType, prompt, examName, source, appContext }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new Error("Network error: Failed to reach AI service");
  }

  return readAIJson<{ response: string }>(res);
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
  appContext,
}: {
  file: File;
  prompt?: string;
  examName?: string;
  source?: string;
  signal?: AbortSignal;
  appContext?: string;
}): Promise<{ response: string }> {
  const { data: userData } = await supabase.auth.getSession();
  if (!userData?.session) throw new Error("Authentication required");

  // Read the PDF as base64.
  if (file.size > 7.5 * 1024 * 1024) throw new Error("PDF too large. Maximum size is 7.5MB.");
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
    res = await backendFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-ai`, {
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
        appContext,
      }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new Error("Network error: Failed to reach AI service");
  }

  return readAIJson<{ response: string }>(res);
}

export async function streamChat({
  messages,
  examName,
  source,
  signal,
  appContext,
  onChunk,
  onDone,
}: {
  messages: { role: string; content: string }[];
  examName?: string;
  source?: string;
  signal?: AbortSignal;
  /** Rich student context summary injected into the AI system prompt */
  appContext?: string;
  onChunk: (text: string) => void;
  onDone: () => void;
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Authentication required");

  let res;
  try {
    res = await backendFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action: "chat", data: { messages, examName, source, appContext } }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new Error("Network error: Failed to reach chat service");
  }

  await consumeChatStream(res, onChunk);
  onDone();
}
