import test from "node:test";
import assert from "node:assert/strict";
import { consumeChatStream, readAIJson } from "../src/lib/ai-response.ts";

function stream(chunks) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

test("SSE records survive split network chunks, CRLF, and missing final newline", async () => {
  let text = "";
  await consumeChatStream(
    stream([
      'data: {"cho',
      'ices":[{"delta":{"content":"Hello "}}]}\r\n\r\n',
      'data:{"choices":[{"delta":{"content":"world"}}]}\n',
      "data: [DONE]",
    ]),
    (part) => {
      text += part;
    },
  );
  assert.equal(text, "Hello world");
});

test("HTTP and legacy HTTP-200 JSON errors cannot become empty chat success", async () => {
  for (const status of [200, 429, 502]) {
    await assert.rejects(
      consumeChatStream(Response.json({ error: "Model unavailable" }, { status }), () => {}),
      /Model unavailable/,
    );
  }
  await assert.rejects(
    readAIJson(new Response("upstream HTML error", { status: 502 })),
    /could not complete/,
  );
});

test("empty, interrupted, malformed and failed SSE responses are errors", async () => {
  for (const data of [
    "data: [DONE]\n",
    'data: {"choices":[{"delta":{"content":"partial"}}]}\n',
    "data: broken-json\n",
    'data: {"error":{"message":"Rate limited"}}\n',
    'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":"length"}]}\n',
  ])
    await assert.rejects(consumeChatStream(stream([data]), () => {}));
});
