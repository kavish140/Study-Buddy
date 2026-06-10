const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";

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
    return JSON.parse(raw);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();

    let result;
    if (action === "generateQuiz") {
      const examContext = data.examName ? `for ${data.examName}` : "for competitive exams (JEE/NEET level)";
      const difficultyGuide = data.difficulty === "hard"
        ? "Questions must be JEE Advanced level — require multi-step reasoning, formula derivation, numerical computation, or conceptual depth. No trivial or definition-based questions."
        : data.difficulty === "medium"
          ? "Questions should be JEE Main level — application-based, requiring formula application and moderate reasoning. Avoid purely definitional questions."
          : "Questions should be NCERT concept-check level — clear but not trivial. Test understanding, not just recall.";
      const system = `You are an expert question setter ${examContext}. Generate rigorous multiple-choice questions suitable for competitive exam preparation. ${difficultyGuide} Every question must be self-contained with 4 distinct options (only one correct), precise scientific language, and a detailed explanation citing the relevant formula or principle. Respond ONLY with valid JSON.`;
      const user = `Generate ${data.count} ${data.difficulty}-difficulty MCQ questions on the topic: "${data.topic}" ${examContext}.\n\nRules:\n- Questions must test deep understanding, not surface recall\n- Include numerical/calculation problems where appropriate\n- Options must be plausible (no obviously wrong distractors)\n- Explanation must cite the formula, law, or concept used\n\nReturn JSON:\n{"questions":[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answerIndex":0,"explanation":"..."}]}\nanswerIndex is 0-3.`;
      result = await callGroq(system, user);
    } else if (action === "generateNotes") {
      const examName = data.examName || "JEE/NEET";
      const system = `You are an expert study coach for ${examName} preparation. You ONLY generate notes for topics that are part of the ${examName} syllabus — Physics, Chemistry, Mathematics (and Biology for NEET). If the requested topic is NOT from the exam syllabus (e.g. random trivia, opinions, unrelated subjects), return {"error": "Topic not in ${examName} syllabus. Please enter a valid exam topic."}. For valid syllabus topics, produce concise exam-focused notes and flashcards. Respond ONLY with valid JSON.`;
      const user = `Generate study notes for topic: "${data.topic}" for ${examName}.\n\nIf this is a valid ${examName} syllabus topic, return:\n{"summary":"3-5 sentence exam-focused summary with key formulas, important facts, and common exam traps","flashcards":[{"q":"...","a":"..."}]}\nGenerate 6 flashcards mixing: formula recall, conceptual understanding, and numerical application questions at ${examName} level.\nIf NOT a valid exam syllabus topic, return: {"error": "Topic not in ${examName} syllabus. Please enter a valid exam topic."}`;
      result = await callGroq(system, user);
      if (result?.error) {
        throw new Error(result.error);
      }
    } else if (action === "parseSyllabus") {
      const system =
        "You convert raw syllabus text into structured subjects and topics. Respond ONLY with valid JSON.";
      const user = `Syllabus text:\n${data.text}\n\nReturn JSON:\n{"subjects":[{"name":"Subject","topics":["Topic 1","Topic 2"]}]}\nGroup related items. Keep topic names short and concrete.`;
      result = await callGroq(system, user);
    } else if (action === "generatePlan") {
      const system = "You create realistic study schedules. Respond ONLY with valid JSON.";
      const user = `Create a ${data.days}-day study plan for these topics: ${data.topics.join(", ")}.\nReturn JSON:\n{"plan":[{"day":1,"tasks":["Task 1","Task 2"]}]}\nBalance review and new material. 2-4 tasks per day.`;
      result = await callGroq(system, user);
    } else if (action === "generateMockTest") {
      const isJEE = (data.examName || "").toLowerCase().includes("jee");
      const isNEET = (data.examName || "").toLowerCase().includes("neet");
      const difficultyNote = isJEE
        ? "Questions MUST be at JEE Main/Advanced difficulty: multi-step reasoning, numerical computation, formula application, conceptual depth. Avoid NCERT-level trivial questions."
        : isNEET
          ? "Questions must be at NEET level: application-based, clinical reasoning for biology, formula-based for physics/chemistry."
          : "Questions should be challenging and application-based, suitable for competitive exam preparation.";
      const system = `You are an elite question setter for ${data.examName || "competitive exams"}. ${difficultyNote} Every question must have exactly 4 options (A,B,C,D), one correct answer, and a detailed explanation citing the formula/principle. Generate questions that would genuinely appear in the actual exam. Respond ONLY with valid JSON.`;
      const sectionInstructions = (data.sections || [])
        .map(
          (s: any) =>
            `Section "${s.name}": ${s.questions} questions from topics: ${(s.topics || []).join(", ")}. Mix numerical, conceptual, and application questions.`,
        )
        .join("\n");
      const user = `Generate a mock test for ${data.examName} with these sections:\n${sectionInstructions}\n\nReturn JSON in this exact shape:\n{"sections":[{"name":"Section Name","questions":[{"id":"q1","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answerIndex":0,"explanation":"Step-by-step explanation citing formula","section":"Section Name","topic":"Topic Name"}]}]}\nEach question must have exactly 4 options. answerIndex is 0-3. Give each question a unique id like q1, q2, etc.`;
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

      const systemPrompt = `You are AcePrep AI Tutor — an expert teacher specializing in ${examName} preparation. You only discuss topics relevant to ${examName} syllabus.

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
        ...(data.messages || []).slice(-20).map((m: any) => ({
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
      });
    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
