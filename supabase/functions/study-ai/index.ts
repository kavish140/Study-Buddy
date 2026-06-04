const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";

async function callGroq(systemText: string, userText: string) {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is missing! Check your Supabase Secrets.");

  const payload = {
    model: "llama-3.3-70b-versatile", // Groq's incredibly fast free model
    messages: [
      { role: "system", content: systemText },
      { role: "user", content: userText }
    ],
    response_format: { type: "json_object" } // Groq natively supports strict JSON
  };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify(payload)
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();

    let result;
    if (action === "generateQuiz") {
      const system = "You are an expert educator. Generate multiple-choice quiz questions. Respond ONLY with valid JSON.";
      const user = `Create ${data.count} ${data.difficulty} multiple-choice questions about: "${data.topic}".\nReturn JSON in this exact shape:\n{"questions":[{"question":"...","options":["A","B","C","D"],"answerIndex":0,"explanation":"..."}]}\nEach question must have exactly 4 options. answerIndex is 0-3.`;
      result = await callGroq(system, user);
    } else if (action === "generateNotes") {
      const system = "You are a concise study coach. Produce study notes and flashcards. Respond ONLY with valid JSON.";
      const user = `Topic: "${data.topic}".\nReturn JSON:\n{"summary":"3-5 sentence clear summary","flashcards":[{"q":"...","a":"..."}]}\nGenerate 6 flashcards covering the most important ideas.`;
      result = await callGroq(system, user);
    } else if (action === "parseSyllabus") {
      const system = "You convert raw syllabus text into structured subjects and topics. Respond ONLY with valid JSON.";
      const user = `Syllabus text:\n${data.text}\n\nReturn JSON:\n{"subjects":[{"name":"Subject","topics":["Topic 1","Topic 2"]}]}\nGroup related items. Keep topic names short and concrete.`;
      result = await callGroq(system, user);
    } else if (action === "generatePlan") {
      const system = "You create realistic study schedules. Respond ONLY with valid JSON.";
      const user = `Create a ${data.days}-day study plan for these topics: ${data.topics.join(", ")}.\nReturn JSON:\n{"plan":[{"day":1,"tasks":["Task 1","Task 2"]}]}\nBalance review and new material. 2-4 tasks per day.`;
      result = await callGroq(system, user);
    } else if (action === "generateMockTest") {
      const system = `You are an expert exam paper setter for ${data.examName || "competitive exams"}. Generate high-quality multiple-choice questions organized by section. Each question must be exam-appropriate in difficulty with 4 options, one correct answer, and a brief explanation. Respond ONLY with valid JSON.`;
      const sectionInstructions = (data.sections || []).map((s: any) =>
        `Section "${s.name}": ${s.questions} questions from topics: ${(s.topics || []).join(", ")}`
      ).join("\n");
      const user = `Generate a mock test for ${data.examName} with these sections:\n${sectionInstructions}\n\nReturn JSON in this exact shape:\n{"sections":[{"name":"Section Name","questions":[{"id":"q1","question":"...","options":["A","B","C","D"],"answerIndex":0,"explanation":"...","section":"Section Name","topic":"Topic Name"}]}]}\nEach question must have exactly 4 options. answerIndex is 0-3. Give each question a unique id like q1, q2, etc.`;
      result = await callGroq(system, user);
    } else if (action === "chat") {
      if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is missing!");

      const examContext = data.examName ? `The student is preparing for ${data.examName}.` : "";
      const systemPrompt = `You are AcePrep AI Tutor — a friendly, knowledgeable study companion. ${examContext} Your role:
- Explain concepts clearly with examples
- Use step-by-step solutions for math/science problems
- Format responses with markdown (headers, bold, lists, code blocks)
- For math, use clear notation
- Be encouraging and supportive
- If asked about a topic, provide exam-relevant insights
- Keep responses concise but thorough`;

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
          "Authorization": `Bearer ${GROQ_API_KEY}`,
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
