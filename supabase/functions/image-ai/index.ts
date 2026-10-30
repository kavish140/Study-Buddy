import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";

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
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Image/PDF analysis is not configured. Please contact support." }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { imageBase64, mimeType, prompt, examName, appContext } = await req.json();

    if (!imageBase64) {
      throw new Error("No image provided. Please upload an image or PDF.");
    }

    // Validate image size (max ~10MB base64 ≈ ~7.5MB file)
    const MAX_BASE64_SIZE = 10 * 1024 * 1024; // 10MB
    if (imageBase64.length > MAX_BASE64_SIZE) {
      return new Response(JSON.stringify({ error: "Image too large. Maximum size is ~7.5MB." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const isPdf = mimeType === "application/pdf";
    const examContext = examName
      ? `The student is preparing for ${examName}.`
      : "The student is preparing for a competitive exam.";

    const systemPrompt = isPdf
      ? `You are AcePrep AI Tutor — an expert at reading and solving problems from scanned notebooks and PDF documents. ${examContext}

The student has uploaded a scanned PDF (which may be a handwritten notebook). Your task:
1. Read through ALL pages of the PDF carefully.
2. Accurately extract any handwritten or printed text, equations, and diagrams.
3. Answer the student's question based on the full content of the notebook.
4. For math/physics problems, show all working steps clearly.
5. Use markdown formatting (headers, bold, lists, LaTeX-style notation where helpful).
6. For math, use clear notation (e.g., x² for x squared, √ for square root).
7. If pages contain diagrams or figures, describe and explain them.
8. At the end, provide the final answer clearly highlighted.
9. If applicable, relate content to relevant concepts from the exam syllabus.

Be thorough, accurate, and encouraging. Cover the entire document, not just the first page.`
      : `You are AcePrep AI Tutor — an expert at reading and solving questions from images. ${examContext}

Your task:
1. Read the question/problem shown in the image carefully.
2. If there is handwritten or printed text, extract it accurately.
3. Solve the problem step by step.
4. For math/physics problems, show all calculations clearly.
5. Use markdown formatting (headers, bold, lists, code blocks).
6. For math, use clear notation (e.g., x² for x squared, √ for square root).
7. If the image contains a diagram, describe it and explain its relevance.
8. At the end, provide the final answer clearly highlighted.
9. If applicable, mention which concept/formula from the exam syllabus this tests.

Be thorough, accurate, and encouraging.`;

    // Append student context if available
    const fullSystemPrompt = appContext
      ? `${systemPrompt}\n\nStudent context — use this to give personalised, relevant answers:${appContext}`
      : systemPrompt;

    const userPrompt = prompt
      ? isPdf
        ? `${prompt}\n\nPlease analyze the attached PDF document (all pages) and respond accordingly.`
        : `${prompt}\n\nPlease analyze the attached image and respond accordingly.`
      : isPdf
        ? "Please read through this scanned PDF notebook and answer any questions or summarize its contents."
        : "Please read the question in this image and solve it step by step.";

    // Call Gemini API with vision
    const model = GEMINI_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const body = {
      systemInstruction: {
        parts: [
          {
            text: "Process, explain, or solve the existing questions in the supplied document. Never invent or generate new questions, quizzes, mock tests, or flashcard questions. If asked to create questions, direct the student to the app's sourced question bank.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: fullSystemPrompt + "\n\n" + userPrompt },
            {
              inlineData: {
                mimeType: mimeType || "image/jpeg",
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    };

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini Error:", errText);
      const message =
        geminiRes.status === 429
          ? "Image/PDF AI usage limit reached. Please wait a moment and try again."
          : "Image/PDF analysis is unavailable. Please try again or contact support.";
      return new Response(JSON.stringify({ error: message }), {
        status: geminiRes.status === 429 ? 429 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiRes.json();

    // Extract the text response
    const candidate = geminiData.candidates?.[0];
    const responseText = candidate?.content?.parts
      ?.filter((part: { text?: string; thought?: boolean }) => !part.thought && part.text)
      .map((part: { text: string }) => part.text)
      .join("\n");
    if (!responseText || (candidate.finishReason && candidate.finishReason !== "STOP")) {
      throw new Error("The document could not be fully analyzed. Try a smaller or clearer file.");
    }

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Image AI Error:", message);

    // Determine if it's a client error (missing data) or server error
    const status = message.includes("missing") || message.includes("No image") ? 400 : 500;

    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: status,
    });
  }
});
