const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

async function callOpenRouter(systemText: string, userText: string) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing or empty! Check your Supabase Secrets.");

  // We use fallback routing across multiple free models in case one is busy
  const payload = {
    models: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemma-4-31b-it:free",
      "nousresearch/hermes-3-llama-3.1-405b:free",
      "openai/gpt-oss-20b:free"
    ],
    route: "fallback",
    messages: [
      { role: "system", content: systemText },
      { role: "user", content: userText }
    ]
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("OpenRouter Error:", errorText);
    throw new Error(`OpenRouter API Error (${res.status}): ${errorText}`);
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
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();

    let result;
    if (action === "generateQuiz") {
      const system = "You are an expert educator. Generate multiple-choice quiz questions. Respond ONLY with valid JSON.";
      const user = `Create ${data.count} ${data.difficulty} multiple-choice questions about: "${data.topic}".\nReturn JSON in this exact shape:\n{"questions":[{"question":"...","options":["A","B","C","D"],"answerIndex":0,"explanation":"..."}]}\nEach question must have exactly 4 options. answerIndex is 0-3.`;
      result = await callOpenRouter(system, user);
    } else if (action === "generateNotes") {
      const system = "You are a concise study coach. Produce study notes and flashcards. Respond ONLY with valid JSON.";
      const user = `Topic: "${data.topic}".\nReturn JSON:\n{"summary":"3-5 sentence clear summary","flashcards":[{"q":"...","a":"..."}]}\nGenerate 6 flashcards covering the most important ideas.`;
      result = await callOpenRouter(system, user);
    } else if (action === "parseSyllabus") {
      const system = "You convert raw syllabus text into structured subjects and topics. Respond ONLY with valid JSON.";
      const user = `Syllabus text:\n${data.text}\n\nReturn JSON:\n{"subjects":[{"name":"Subject","topics":["Topic 1","Topic 2"]}]}\nGroup related items. Keep topic names short and concrete.`;
      result = await callOpenRouter(system, user);
    } else if (action === "generatePlan") {
      const system = "You create realistic study schedules. Respond ONLY with valid JSON.";
      const user = `Create a ${data.days}-day study plan for these topics: ${data.topics.join(", ")}.\nReturn JSON:\n{"plan":[{"day":1,"tasks":["Task 1","Task 2"]}]}\nBalance review and new material. 2-4 tasks per day.`;
      result = await callOpenRouter(system, user);
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
