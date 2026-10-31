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
