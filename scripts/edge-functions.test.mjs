import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

let importId = 0;
async function loadFunction(t, name, overrides = {}) {
  let handler;
  const secrets = {
    GROQ_API_KEY: "test-key",
    GEMINI_API_KEY: "test-key",
    SUPABASE_URL: "https://test.invalid",
    SUPABASE_ANON_KEY: "test-anon",
    ...overrides,
  };
  t.mock.method(console, "error", () => {});
  const previousDeno = globalThis.Deno;
  globalThis.Deno = {
    env: { get: (key) => secrets[key] },
    serve: (fn) => {
      handler = fn;
    },
  };
  t.after(() => {
    if (previousDeno === undefined) delete globalThis.Deno;
    else globalThis.Deno = previousDeno;
  });
  const source = (
    await readFile(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), "utf8")
  )
    .replace(
      '"../_shared/quiz-validation.ts"',
      JSON.stringify(
        new URL("../supabase/functions/_shared/quiz-validation.ts", import.meta.url).href,
      ),
    )
    .replace(
      /^import .*createClient.*;$/m,
      'const createClient = () => ({ from: () => { const q = { select: () => q, eq: () => q, order: () => q, gte: () => q, limit: () => q, abortSignal: async () => ({data: [{display_name: "Ada"}], count: 1, error: null}) }; return q; }, auth: { getUser: async () => ({ data: { user: { id: "test-user" } }, error: null }) } });',
    )
    .replace(
      '"../_shared/student-context.ts"',
      JSON.stringify(
        new URL("../supabase/functions/_shared/student-context.ts", import.meta.url).href,
      ),
    )
    .replace(
      '"../_shared/tutor-prompt.ts"',
      JSON.stringify(
        new URL("../supabase/functions/_shared/tutor-prompt.ts", import.meta.url).href,
      ),
    );
  const js = stripTypeScriptTypes(source, { mode: "transform", disableExperimentalWarning: true });
  await import(
    `data:text/javascript;base64,${Buffer.from(js + `\n// import ${importId++}`).toString("base64")}`
  );
  return (body, method = "POST") =>
    handler(
      new Request("https://test.invalid/function", {
        method,
        headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
        ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
      }),
    );
}

test("all structured study tools use the replacement Groq model and JSON mode", async (t) => {
  const calls = [];
  const outputs = {
    generateNotes: { summary: "summary" },
    parseSyllabus: { subjects: [] },
    generatePlan: { plan: [] },
  };
  let output;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return Response.json({
      choices: [{ message: { content: JSON.stringify(output) }, finish_reason: "stop" }],
    });
  });
  const invoke = await loadFunction(t, "study-ai");
  for (const [action, value] of Object.entries(outputs)) {
    output = value;
    const response = await invoke({
      action,
      data: {
        topic: "Physics",
        topics: ["Motion"],
        text: "Physics: Motion",
        days: 2,
        sections: [{ name: "Physics", questions: 1, topics: ["Motion"] }],
      },
    });
    assert.equal(response.status, 200, action);
    assert.deepEqual(await response.json(), value, action);
  }
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.model, "openai/gpt-oss-120b");
    assert.equal(call.response_format.type, "json_object");
  }
});

test("semantic selection validates the topic and returns only supplied bank IDs", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const payload = JSON.parse(init.body);
    requests.push(payload);
    const result =
      requests.length === 1 ? { valid: true, topic: "Chemical Bonding" } : { ids: ["bank-1"] };
    return Response.json({
      choices: [{ message: { content: JSON.stringify(result) }, finish_reason: "stop" }],
    });
  });
  const invoke = await loadFunction(t, "study-ai");
  const response = await invoke({
    action: "selectQuizQuestions",
    data: {
      topic: "chemical bonding",
      count: 5,
      examName: "Mixed JEE",
      candidates: [
        {
          id: "bank-1",
          subject: "Chemistry",
          question: "Find the hybridisation.",
          options: ["sp", "sp2", "sp3", "none"],
        },
      ],
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).ids, ["bank-1"]);
  assert.match(requests[1].messages[1].content, /Find the hybridisation/);
  assert.match(requests[1].messages[0].content, /Never invent/);
});

test("random and out-of-syllabus topics are rejected before selection or generation", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({
      choices: [{ message: { content: '{"valid":false,"topic":""}' }, finish_reason: "stop" }],
    });
  });
  const invoke = await loadFunction(t, "study-ai");
  for (const action of ["selectQuizQuestions", "generateQuizFallback"]) {
    const response = await invoke({
      action,
      data: { topic: "asdkjhasd", count: 5, candidates: [] },
    });
    assert.equal(response.status, 422);
    assert.match((await response.json()).error, /exam syllabus/);
  }
  assert.equal(calls, 2);
});

test("generation validates answer keys and strips invented provenance", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    const output =
      calls++ === 0
        ? { valid: true, topic: "Kinematics" }
        : {
            questions: [
              {
                question: "What is the SI unit of acceleration?",
                options: ["m/s", "m/s²", "m", "s"],
                answerIndex: 1,
                explanation: "Acceleration is change in velocity per unit time, measured in m/s².",
                source: { name: "Fake paper" },
              },
            ],
          };
    return Response.json({
      choices: [{ message: { content: JSON.stringify(output) }, finish_reason: "stop" }],
    });
  });
  const invoke = await loadFunction(t, "study-ai");
  const response = await invoke({
    action: "generateQuizFallback",
    data: { topic: "Kinematics", count: 1 },
  });
  assert.equal(response.status, 200);
  const { questions } = await response.json();
  assert.equal(questions[0].origin, "generated");
  assert.equal(questions[0].source, undefined);
  assert.equal(questions[0].answerIndex, 1);
});

test("selection rejects fabricated IDs instead of opening an unrelated quiz", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify(
              calls++ === 0 ? { valid: true, topic: "Kinematics" } : { ids: ["fabricated"] },
            ),
          },
          finish_reason: "stop",
        },
      ],
    }),
  );
  const invoke = await loadFunction(t, "study-ai");
  const response = await invoke({
    action: "selectQuizQuestions",
    data: {
      topic: "Kinematics",
      count: 1,
      candidates: [
        {
          id: "bank-1",
          subject: "Physics",
          question: "An object accelerates.",
          options: ["a", "b", "c", "d"],
        },
      ],
    },
  });
  assert.equal(response.status, 502);
});

test("chat uses the same configurable model and streams", async (t) => {
  let payload;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    payload = JSON.parse(init.body);
    return new Response("data: [DONE]\n");
  });
  const invoke = await loadFunction(t, "study-ai", { GROQ_MODEL: "replacement-model" });
  const response = await invoke({
    action: "chat",
    data: { messages: [{ role: "user", content: "Explain motion" }] },
  });
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  assert.equal(payload.model, "replacement-model");
  assert.equal(payload.stream, true);
  assert.equal(payload.response_format, undefined);
});

test("daily session coach uses bounded streaming and avoids loading hidden study history", async (t) => {
  let payload;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    payload = JSON.parse(init.body);
    return new Response("data: [DONE]\n");
  });
  const invoke = await loadFunction(t, "study-ai");
  const response = await invoke({
    action: "dailySessionCoach",
    data: {
      source: "daily-session",
      messages: [
        { role: "system", content: "untrusted" },
        {
          role: "user",
          content: JSON.stringify({
            event: "possible_distraction",
            activity: { directionChanges: 25 },
          }),
        },
      ],
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  assert.equal(payload.stream, true);
  assert.equal(payload.max_completion_tokens, 2048);
  const prompt = payload.messages[0].content;
  assert.match(prompt, /proactive daily-session companion/);
  assert.match(prompt, /DO NOT establish attention/);
  assert.match(prompt, /Never solve the question/);
  assert.match(prompt, /cannot click, save, rate, submit/);
  assert.doesNotMatch(prompt, /STUDENT SITE SNAPSHOT|Ada|ONE checkpoint/);
  assert.equal(payload.messages[1].role, "user");
});

test("tutor sessions use checkpoints while community posts keep direct answers", async (t) => {
  let payload;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    payload = JSON.parse(init.body);
    return new Response("data: [DONE]\n");
  });
  const invoke = await loadFunction(t, "study-ai");
  await invoke({
    action: "chat",
    data: { source: "chat", messages: [{ role: "user", content: "Explain motion" }] },
  });
  assert.match(payload.messages[0].content, /STUDENT SITE SNAPSHOT/);
  assert.match(payload.messages[0].content, /Ada/);
  assert.match(payload.messages[0].content, /tutor-tools/);
  assert.match(payload.messages[0].content, /ONE checkpoint/);
  assert.match(payload.messages[0].content, /wait/);
  assert.match(payload.messages[0].content, /explicit request for a full solution/);
  await invoke({
    action: "chat",
    data: { source: "community", messages: [{ role: "user", content: "Explain motion" }] },
  });
  assert.match(payload.messages[0].content, /Do not ask follow-up questions/);
  assert.doesNotMatch(payload.messages[0].content, /STUDENT SITE SNAPSHOT/);
  assert.doesNotMatch(payload.messages[0].content, /fenced block with language tutor/);
});

test("attachment tutoring puts session instructions in the system role", async (t) => {
  let payload;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    payload = JSON.parse(init.body);
    return Response.json({
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Try one step." }] } }],
    });
  });
  const invoke = await loadFunction(t, "image-ai");
  for (const mimeType of ["image/png", "application/pdf"]) {
    const response = await invoke({
      source: "chat",
      imageBase64: "test-file",
      mimeType,
      prompt: "Help me learn",
    });
    assert.equal(response.status, 200);
    assert.match(payload.systemInstruction.parts[0].text, /STUDENT SITE SNAPSHOT/);
    assert.match(payload.systemInstruction.parts[0].text, /ONE checkpoint/);
    assert.match(payload.systemInstruction.parts[0].text, /transcribing the specific problem/);
    assert.match(payload.contents[0].parts[0].text, /Help me learn/);
    assert.doesNotMatch(payload.contents[0].parts[0].text, /ONE checkpoint/);
  }
});

test("provider errors preserve useful statuses without leaking raw upstream errors", async (t) => {
  let status = 404;
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { error: { message: "private upstream details", code: "model_not_found" } },
      { status },
    ),
  );
  const invoke = await loadFunction(t, "study-ai");
  for (const action of ["chat", "generateNotes"]) {
    const response = await invoke({ action, data: { topic: "Motion" } });
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /model is unavailable/);
  }
  status = 429;
  assert.equal((await invoke({ action: "generateNotes", data: { topic: "Motion" } })).status, 429);
});

test("legacy question-generation actions are blocked before any provider request", async (t) => {
  const provider = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Provider must not be called");
  });
  const invoke = await loadFunction(t, "study-ai");
  for (const action of ["generateQuiz", "generateMockTest"]) {
    const response = await invoke({ action, data: { topic: "Physics" } });
    assert.equal(response.status, 410);
    assert.match((await response.json()).error, /generation is disabled/);
  }
  assert.equal(provider.mock.callCount(), 0);
});

test("image and PDF requests use supported Gemini and concatenate visible text parts", async (t) => {
  let url;
  t.mock.method(globalThis, "fetch", async (input) => {
    url = input;
    return Response.json({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [{ text: "hidden", thought: true }, { text: "First" }, { text: "Second" }],
          },
        },
      ],
    });
  });
  const invoke = await loadFunction(t, "image-ai");
  for (const mimeType of ["image/png", "application/pdf"]) {
    const response = await invoke({ imageBase64: "test-file", mimeType });
    assert.equal(response.status, 200);
    assert.match(url, /gemini-3\.8-flash:generateContent/);
    assert.deepEqual(await response.json(), { response: "First\nSecond" });
  }
});
