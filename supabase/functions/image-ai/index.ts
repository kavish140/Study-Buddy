const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is missing! Add it to your Supabase Secrets at Settings → Edge Functions → Secrets.",
      );
    }

    const { imageBase64, mimeType, prompt, examName } = await req.json();

    if (!imageBase64) {
      throw new Error("No image provided. Please upload an image.");
    }

    const examContext = examName
      ? `The student is preparing for ${examName}.`
      : "The student is preparing for a competitive exam.";

    const systemPrompt = `You are AcePrep AI Tutor — an expert at reading and solving questions from images. ${examContext}

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

    const userPrompt = prompt
      ? `${prompt}\n\nPlease analyze the attached image and respond accordingly.`
      : "Please read the question in this image and solve it step by step.";

    // Call Gemini API with vision
    const model = "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt + "\n\n" + userPrompt },
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
        maxOutputTokens: 4096,
      },
    };

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini Error:", errText);
      throw new Error(`Gemini API Error (${geminiRes.status}): ${errText}`);
    }

    const geminiData = await geminiRes.json();

    // Extract the text response
    const responseText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't analyze this image.";

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Image AI Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
