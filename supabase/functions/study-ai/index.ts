import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { INTERACTIVE_TUTOR_PROMPT } from "../_shared/tutor-prompt.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";

class AIServiceError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

async function requestGroq(messages: { role: string; content: string }[], stream = false) {
  if (!GROQ_API_KEY)
    throw new AIServiceError("The AI service is not configured. Please contact support.", 503);
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      stream,
      max_completion_tokens: 16384,
      ...(GROQ_MODEL.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
      ...(!stream ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const details = await res.text();
    console.error("Groq request failed", res.status, details);
    const message =
      res.status === 429
        ? "AI usage limit reached. Please wait a moment and try again."
        : res.status === 401 || res.status === 403
          ? "The AI service credentials or model access need attention. Please contact support."
          : res.status === 404 ||
              details.includes("model_decommissioned") ||
              details.includes("model_not_found")
            ? "The configured AI model is unavailable. Please contact support."
            : "The AI service is temporarily unavailable. Please try again.";
    throw new AIServiceError(message, res.status === 429 ? 429 : 502);
  }
  return res;
}

/** Strip characters/patterns that could be used for prompt injection */
function sanitizeInput(input: string, maxLength = 500): string {
  return (
    input
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") // control chars
      .slice(0, maxLength)
  );
}

async function callGroq(systemText: string, userText: string) {
  const res = await requestGroq([
    { role: "system", content: systemText },
    { role: "user", content: userText },
  ]);

  const data = await res.json();
  if (data.choices?.[0]?.finish_reason === "length") {
    throw new AIServiceError(
      "The AI response was too long. Please request fewer questions or topics.",
    );
  }
  const rawText = data.choices?.[0]?.message?.content || "";

  try {
    return JSON.parse(rawText);
  } catch (e) {
    const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenced ? fenced[1] : rawText;
    try {
      return JSON.parse(raw);
    } catch (parseError) {
      throw new AIServiceError("The AI returned an invalid response. Please try again.");
    }
  }
}

interface Section {
  name: string;
  questions: number;
  topics: string[];
}

interface ChatMessage {
  role: string;
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", Allow: "POST, OPTIONS" },
    });
  }

  // Verify JWT authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid or expired authentication token" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const { action, data } = await req.json();

    if (action === "generateQuiz" || action === "generateMockTest") {
      return new Response(
        JSON.stringify({
          error: "AI question generation is disabled. Use the sourced question bank instead.",
        }),
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action in request body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!data) {
      return new Response(JSON.stringify({ error: "Missing data in request body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    let result;
    if (action === "generateNotes") {
      const examName = data.examName || "JEE/NEET";
      const noteTopic = sanitizeInput(data.topic || "", 200);
      const system = `You are an expert study coach for ${examName} preparation. You ONLY generate notes for topics that are part of the ${examName} syllabus — Physics, Chemistry, Mathematics (and Biology for NEET). If the requested topic is NOT from the exam syllabus (e.g. random trivia, opinions, unrelated subjects), return {"error": "Topic not in ${examName} syllabus. Please enter a valid exam topic."}.

For valid syllabus topics:
- Write a concise exam-focused summary: highlight key formulas in **bold**, mention common exam traps, and list the most important facts.
- Use markdown in the summary: **bold** formulas and key terms, numbered lists for steps. IMPORTANT: For math/physics equations, you MUST use $ for inline math and $$ for block math. Since you are outputting JSON, you MUST double-escape all LaTeX backslashes (e.g. $\\\\sin x$, $$\\frac{1}{2}$$).
- Summarize the topic only. Do not generate questions, quizzes, or flashcards.
${data.appContext ? `\nUse the following student context to tailor notes (e.g. emphasize topics they're weaker in, reference their study plan):${data.appContext}\n` : ""}Respond ONLY with valid JSON.`;
      const user = `Generate study notes for topic: "${noteTopic}" for ${examName}.

If this is a valid ${examName} syllabus topic, return:
{"summary":"Concise exam-focused summary with formulas, concepts, and common traps."}
If NOT a valid exam syllabus topic, return: {"error": "Topic not in ${examName} syllabus. Please enter a valid exam topic."}`;
      result = await callGroq(system, user);
      if (result?.error) {
        throw new AIServiceError(result.error, 422);
      }
    } else if (action === "parseSyllabus") {
      const syllabusText = sanitizeInput(data.text || "", 2000);
      const examName = data.examName ? sanitizeInput(data.examName, 100) : null;
      const examCtx = examName
        ? `You are converting a ${examName} syllabus into a structured subject/topic map.`
        : "You convert raw syllabus text into structured subjects and topics.";
      const system = `${examCtx} Group logically related topics under their correct subject headings. Keep topic names short, concrete, and consistent with how they appear in official exam syllabi. Respond ONLY with valid JSON.`;
      const user = `Syllabus text:\n${syllabusText}\n\nReturn JSON:\n{"subjects":[{"name":"Subject","topics":["Topic 1","Topic 2"]}]}\nGroup related items. Keep topic names short and concrete. Do not invent topics not present in the text.`;
      result = await callGroq(system, user);
    } else if (action === "generatePlan") {
      const planTopics = (data.topics || []).map((t: string) => sanitizeInput(t, 200));
      const examName = data.examName ? sanitizeInput(data.examName, 100) : null;
      const examCtx = examName ? `for ${examName} preparation` : "for competitive exam preparation";
      const system =
        data.source === "onboarding"
          ? `You are an expert academic counselor creating an initial foundational study schedule for a new student ${examCtx}. Keep it encouraging, realistic, and highly structured. Prioritise weaker/foundational topics early, gradually increase difficulty. Balance revision and new material.${data.appContext ? `\nStudent context:${data.appContext}` : ""} Respond ONLY with valid JSON.`
          : `You are an expert academic planner creating a targeted study schedule ${examCtx}. Structure the plan so that prerequisites are covered before advanced topics. Allocate more days to complex/high-weightage topics. Include dedicated revision sessions. Be realistic — 2-4 focused tasks per day.${data.appContext ? `\nStudent context:${data.appContext}` : ""} Respond ONLY with valid JSON.`;
      const user = `Create a ${data.days}-day study plan for these topics: ${planTopics.join(", ")}.
Return JSON:
{"plan":[{"day":1,"tasks":["Task 1","Task 2"]}]}
Balance review and new material. 2-4 tasks per day. Tasks must be specific and actionable (e.g. "Solve 10 problems on Newton's 3rd Law" not just "Study Newton's Laws").`;
      result = await callGroq(system, user);
    } else if (action === "chat") {
      const examName = data.examName || "JEE Main";

      const difficultyMandate =
        "Never create or invent practice questions, MCQs, quizzes, mock tests, or flashcard questions. Work only with existing questions supplied by the student or the question bank. If asked for a new question or test, direct the student to /pyq, /quiz or /mock-test. You may explain concepts, solve supplied questions, and evaluate answers.";

      const studentContext = data.appContext
        ? `\n\nIMPORTANT — Use this student context to give personalised, relevant answers. Reference their study plan, weak subjects, or exam timeline when helpful:${data.appContext}`
        : "";

      const systemPrompt =
        data.source === "community"
          ? `You are AcePrep AI — an expert educator answering a student's question on a community forum for ${examName}.

${difficultyMandate}

Rules you MUST follow at all times:
- Provide a direct, highly detailed, and authoritative answer to the forum post.
- Act like a helpful expert on a forum, not an interactive chatbot. Do not ask follow-up questions.
- Use markdown formatting: **bold** for key terms, code blocks for equations, numbered lists for steps.
- For math/physics: show every step, name every formula used.
- For chemistry: show mechanisms, electron configurations, or reaction equations where relevant.
- Be concise but complete — avoid unnecessary filler text.${studentContext}`
          : `You are AcePrep AI Tutor — an expert teacher specializing in ${examName} preparation. You only discuss topics relevant to ${examName} syllabus.

${INTERACTIVE_TUTOR_PROMPT}${studentContext}`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...(data.messages || []).slice(-20).map((m: ChatMessage) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      const groqRes = await requestGroq(messages, true);

      // Stream the response back
      return new Response(groqRes.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
        status: 200, // Explicitly return 200 for successful stream
      });
    } else {
      throw new AIServiceError("Unknown AI action.", 400);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message =
      error instanceof AIServiceError
        ? error.message
        : error instanceof SyntaxError
          ? "Invalid request body."
          : error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
            ? "The AI request timed out. Please try again with fewer questions or a shorter prompt."
            : "Unable to complete the AI request. Please try again.";
    console.error("Function Error:", message);

    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status:
        error instanceof AIServiceError ? error.status : error instanceof SyntaxError ? 400 : 502,
    });
  }
});
