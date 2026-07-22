import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";

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
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is missing! Check your Supabase Secrets.");

  const payload = {
    model: "llama-3.3-70b-versatile", // Groq's incredibly fast free model
    messages: [
      { role: "system", content: systemText },
      { role: "user", content: userText },
    ],
    response_format: { type: "json_object" }, // Groq natively supports strict JSON
  };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Groq Error:", errorText);
    throw new Error(`Groq API Error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content || "";

  try {
    return JSON.parse(rawText);
  } catch (e) {
    const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenced ? fenced[1] : rawText;
    try {
      return JSON.parse(raw);
    } catch (parseError) {
      throw new Error("Failed to parse AI response as JSON: " + raw);
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
    if (action === "generateQuiz") {
      const count = Math.max(1, Math.min(20, Number(data.count) || 5));
      const topic = sanitizeInput(data.topic || "", 200);
      const examContext = data.examName
        ? `for ${data.examName}`
        : "for competitive exams (JEE/NEET level)";
      const difficultyGuide =
        data.difficulty === "hard"
          ? "Questions must be JEE Advanced level — require multi-step reasoning, formula derivation, numerical computation, or conceptual depth. No trivial or definition-based questions."
          : data.difficulty === "medium"
            ? "Questions should be JEE Main level — application-based, requiring formula application and moderate reasoning. Avoid purely definitional questions."
            : "Questions should be NCERT concept-check level — clear but not trivial. Test understanding, not just recall.";
      const sourceContext =
        data.source === "pyq"
          ? `You are an expert examiner curating Previous Year Questions (PYQs) ${examContext}. ${difficultyGuide} Generate questions that PERFECTLY mimic the style, rigor, and format of actual past ${data.examName || "competitive exam"} papers. They must feel like real exam questions.`
          : data.source === "notes"
            ? `You are an expert question setter ${examContext} creating questions directly based on the student's own notes. ${difficultyGuide} Questions should test exactly what a student studying these notes needs to know — application, not memorisation.`
            : `You are an expert question setter ${examContext}. Generate rigorous multiple-choice questions suitable for competitive exam preparation. ${difficultyGuide} Every question must be self-contained with 4 distinct options (only one correct), precise scientific language, and a detailed explanation.`;
      const system = `${sourceContext} In your explanation field, use markdown formatting: **bold** key terms and formulas, use numbered steps for multi-step solutions. IMPORTANT: For math/physics equations, you MUST use $ for inline math and $$ for block math. Since you are outputting JSON, you MUST double-escape all LaTeX backslashes (e.g. $\\\\sin x$, $$\\frac{1}{2}$$). Respond ONLY with valid JSON.`;
      const user = `Generate ${count} ${data.difficulty}-difficulty MCQ questions on the topic: "${topic}" ${examContext}.

Rules:
- Questions must test deep understanding, not surface recall
- Include numerical/calculation problems where appropriate
- Options must be plausible (no obviously wrong distractors)
- Explanation: show every step, cite the formula/law/concept, **bold** the final answer

Return JSON:
{"questions":[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answerIndex":0,"explanation":"..."}]}
answerIndex is 0-3.`;
      result = await callGroq(system, user);
    } else if (action === "generateNotes") {
      const examName = data.examName || "JEE/NEET";
      const noteTopic = sanitizeInput(data.topic || "", 200);
      const system = `You are an expert study coach for ${examName} preparation. You ONLY generate notes for topics that are part of the ${examName} syllabus — Physics, Chemistry, Mathematics (and Biology for NEET). If the requested topic is NOT from the exam syllabus (e.g. random trivia, opinions, unrelated subjects), return {"error": "Topic not in ${examName} syllabus. Please enter a valid exam topic."}.

For valid syllabus topics:
- Write a concise exam-focused summary: highlight key formulas in **bold**, mention common exam traps, and list the most important facts.
- Use markdown in the summary: **bold** formulas and key terms, numbered lists for steps. IMPORTANT: For math/physics equations, you MUST use $ for inline math and $$ for block math. Since you are outputting JSON, you MUST double-escape all LaTeX backslashes (e.g. $\\\\sin x$, $$\\frac{1}{2}$$).
- Generate 6 high-quality flashcards mixing: formula recall, conceptual understanding, and numerical application at ${examName} level.
Respond ONLY with valid JSON.`;
      const user = `Generate study notes for topic: "${noteTopic}" for ${examName}.

If this is a valid ${examName} syllabus topic, return:
{"summary":"3-5 sentence exam-focused summary. Use **bold** for key formulas and terms. Include common exam traps and important facts.","flashcards":[{"q":"...","a":"..."}]}
Flashcards: mix formula recall (e.g. Q: State Newton's 2nd law A: F=ma), conceptual (why/how), and numerical (solve for X given Y) questions at ${examName} standard.
If NOT a valid exam syllabus topic, return: {"error": "Topic not in ${examName} syllabus. Please enter a valid exam topic."}`;
      result = await callGroq(system, user);
      if (result?.error) {
        throw new Error(result.error);
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
          ? `You are an expert academic counselor creating an initial foundational study schedule for a new student ${examCtx}. Keep it encouraging, realistic, and highly structured. Prioritise weaker/foundational topics early, gradually increase difficulty. Balance revision and new material. Respond ONLY with valid JSON.`
          : `You are an expert academic planner creating a targeted study schedule ${examCtx}. Structure the plan so that prerequisites are covered before advanced topics. Allocate more days to complex/high-weightage topics. Include dedicated revision sessions. Be realistic — 2-4 focused tasks per day. Respond ONLY with valid JSON.`;
      const user = `Create a ${data.days}-day study plan for these topics: ${planTopics.join(", ")}.
Return JSON:
{"plan":[{"day":1,"tasks":["Task 1","Task 2"]}]}
Balance review and new material. 2-4 tasks per day. Tasks must be specific and actionable (e.g. "Solve 10 problems on Newton's 3rd Law" not just "Study Newton's Laws").`;
      result = await callGroq(system, user);
    } else if (action === "generateMockTest") {
      const isJEE = (data.examName || "").toLowerCase().includes("jee");
      const isNEET = (data.examName || "").toLowerCase().includes("neet");
      const difficultyNote = isJEE
        ? "Questions MUST be at JEE Main/Advanced difficulty: multi-step reasoning, numerical computation, formula application, conceptual depth. Avoid NCERT-level trivial questions. Include integer-type and multi-correct style questions where appropriate."
        : isNEET
          ? "Questions must be at NEET level: application-based, clinical reasoning for biology, formula-based for physics/chemistry. Questions should reflect actual NEET exam difficulty and style."
          : "Questions should be challenging and application-based, suitable for competitive exam preparation. Avoid trivial recall questions.";
      const system = `You are an elite question setter for ${data.examName || "competitive exams"}. ${difficultyNote} Every question must have exactly 4 options (A,B,C,D), one correct answer, and a detailed step-by-step explanation citing the formula/principle used. In the explanation field, use markdown: **bold** key formulas and the final answer, use numbered steps for multi-step solutions. IMPORTANT: For math/physics equations, you MUST use $ for inline math and $$ for block math. Since you are outputting JSON, you MUST double-escape all LaTeX backslashes (e.g. $\\\\sin x$, $$\\frac{1}{2}$$). Generate questions that would genuinely appear in the actual exam. Respond ONLY with valid JSON.`;
      const sectionInstructions = (data.sections || [])
        .map(
          (s: Section) =>
            `Section "${sanitizeInput(s.name, 200)}": ${s.questions} questions from topics: ${(s.topics || []).map((t: string) => sanitizeInput(t, 200)).join(", ")}. Mix numerical, conceptual, and application questions.`,
        )
        .join("\n");
      const user = `Generate a mock test for ${data.examName} with these sections:\n${sectionInstructions}\n\nReturn JSON in this exact shape:\n{"sections":[{"name":"Section Name","questions":[{"id":"q1","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answerIndex":0,"explanation":"Step-by-step explanation with **bold** formulas and final answer","section":"Section Name","topic":"Topic Name"}]}]}\nEach question must have exactly 4 options. answerIndex is 0-3. Give each question a unique id like q1, q2, etc.`;
      result = await callGroq(system, user);
    } else if (action === "chat") {
      if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is missing!");

      const examName = data.examName || "JEE Main";
      const isJEE = examName.toLowerCase().includes("jee");
      const isNEET = examName.toLowerCase().includes("neet");

      const difficultyMandate = isJEE
        ? `CRITICAL: All quiz questions you generate MUST be at JEE Main or JEE Advanced difficulty. This means:
- Questions must require multi-step mathematical reasoning
- Include numerical computation with substitution into formulas
- Options must be 4 plausible numerical values (not silly distractors like 0 or "none of the above")
- Difficulty comparable to actual JEE papers — NOT class 6-10 level
- Bad example (FORBIDDEN): "A car goes 240km in 4hr, find speed" — this is grade 5 level
- Good example: "A block of mass 2kg on a rough surface (μ=0.3) is pulled by F=20N at 30° to horizontal. Find acceleration." `
        : isNEET
          ? `CRITICAL: All quiz questions MUST be at NEET difficulty — application-based biology/chemistry/physics, clinical reasoning, and formula application at 12th standard level.`
          : `CRITICAL: All questions must be at competitive exam difficulty — application-based, not rote recall.`;

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
- Be concise but complete — avoid unnecessary filler text.`
          : `You are AcePrep AI Tutor — an expert teacher specializing in ${examName} preparation. You only discuss topics relevant to ${examName} syllabus.

${difficultyMandate}

Rules you MUST follow at all times:
- When asked to "Quiz me on this" → generate 1 MCQ at ${isJEE ? "JEE Advanced" : "competitive exam"} difficulty on the EXACT topic discussed above. Always 4 options with specific numerical/conceptual values.
- When asked to "Explain simpler" → re-explain the last concept using a different analogy or approach, not a dumbed-down version
- When asked to "Give an example" → give a SOLVED ${examName} exam-style problem, not a textbook definition example
- Use markdown formatting: **bold** for key terms, code blocks for equations, numbered lists for steps
- For all math/physics: show every step, name every formula used (e.g. "Using Newton's 2nd law: F=ma")
- For chemistry: show mechanisms, electron configurations, or reaction equations where relevant
- Never generate questions easier than ${examName} standard
- Be concise but complete — avoid unnecessary filler text`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...(data.messages || []).slice(-20).map((m: ChatMessage) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          stream: true,
        }),
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        throw new Error(`Groq API Error (${groqRes.status}): ${errText}`);
      }

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
      throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Function Error:", message);

    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
