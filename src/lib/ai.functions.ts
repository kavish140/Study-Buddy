import { supabase } from "./supabase";
import { backendFetch } from "./backend-request";
import { consumeChatStream, readAIJson } from "./ai-response";
import { validateAIResult } from "./ai-validation";
import { drawBankQuestions, examIdFromName, filterBank, loadQuestionBank } from "./question-bank";
import { MAX_PDF_BYTES } from "./chat-attachments";
import { selectQuiz } from "./quiz-selection";
import { toQuizQuestion } from "./question-bank";
import { userErrorMessage } from "./user-error";

export async function getHybridQuizQuestions({
  data,
  onProgress,
}: {
  data: { topic: string; count: number; difficulty?: string; examName?: string };
  onProgress?: (message: string) => void;
}) {
  const { data: initialSession } = await supabase.auth.getSession();
  const userId = initialSession.session?.user.id;
  if (!userId) throw new Error("Your session expired. Please sign in again.");
  const examId = examIdFromName(data.examName);
  if (!["jee", "jee-main", "jee-advanced", "neet"].includes(examId))
    throw new Error("Quiz practice is not available for this exam yet.");
  const result = await selectQuiz(data, {
    load: () => loadQuestionBank(examId),
    reserve: (questions, count) => drawBankQuestions(questions, count, true),
    convert: toQuizQuestion,
    select: (request) =>
      invokeEdgeFunction("selectQuizQuestions", {
        ...request,
        candidates: request.candidates.map(({ id, subject, topic, tags, question, options }) => ({
          id,
          subject,
          topic,
          tags,
          question,
          options,
        })),
      }),
    generate: (request) => invokeEdgeFunction("generateQuizFallback", request),
    progress: onProgress,
  });
  const { data: currentSession } = await supabase.auth.getSession();
  if (currentSession.session?.user.id !== userId)
    throw new Error("Your account changed. Please start the quiz again.");
  return result;
}

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
    throw new Error(userErrorMessage(err, "Failed to reach AI service. Please try again."));
  }

  if (error) {
    if (error.context instanceof Response) await readAIJson(error.context);
    throw new Error(userErrorMessage(error, "Failed to reach AI service. Please try again."));
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
  const cards = await drawBankQuestions(filterBank(bank, { search: data.topic }), 6, true);
  return {
    ...notes,
    flashcards: cards.map((q) => ({
      source: q.source,
      q: `${q.question}${q.options.length ? `\n\n${q.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join("\n\n")}` : ""}`,
      a: `${q.answer}${q.explanation ? `\n\n${q.explanation}` : ""}`,
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
  if (file.size > MAX_PDF_BYTES) throw new Error("PDF too large. Maximum size is 7.5 MB.");
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
      body: JSON.stringify({
        action: source === "daily-session" ? "dailySessionCoach" : "chat",
        data: { messages, examName, source, appContext },
      }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new Error("Network error: Failed to reach chat service");
  }

  await consumeChatStream(res, onChunk);
  onDone();
}
