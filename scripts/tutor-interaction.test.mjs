import test from "node:test";
import assert from "node:assert/strict";
import { parseTutorResponse, formatTutorText } from "../src/lib/tutor-interaction.ts";

test("JSON-labelled checkpoints render as controls rather than raw code", () => {
  const result = parseTutorResponse(
    'Your turn.\n```json\n{"question":"Choose your response.","options":[]}\n```',
  );
  assert.equal(result.content, "Your turn.");
  assert.deepEqual(result.checkpoint, { question: "Choose your response.", options: [] });
  const code = 'Example:\n```json\n{"value":42}\n```';
  assert.equal(parseTutorResponse(code).content, code);
});

test("run-together answer options get separate paragraphs without changing code", () => {
  const options = "A) Bond order 1 B) Bond order 2 C) Paramagnetic D) Diamagnetic";
  assert.equal(formatTutorText(options), options.replaceAll(/ (?=[B-D]\))/g, "\n\n"));
  const code = `\`\`\`text\n${options}\n\`\`\``;
  assert.equal(formatTutorText(code), code);
});

test("checkpoint choices preserve equations and free responses", () => {
  const parsed = parseTutorResponse(
    'Use Newton\'s law.\n```tutor\n{"question":"Which formula applies?","options":["F = ma","p = mv","F = ma"]}\n```',
  );
  assert.equal(parsed.content, "Use Newton's law.");
  assert.deepEqual(parsed.checkpoint, {
    question: "Which formula applies?",
    options: ["F = ma", "p = mv"],
  });
  assert.deepEqual(
    parseTutorResponse(
      'Think about direction.\n```tutor\n{"question":"Explain your reasoning.","options":[]}\n```',
    ).checkpoint.options,
    [],
  );
});

test("streamed checkpoint JSON never becomes teaching text or premature controls", () => {
  const text = 'One small step.\n```tutor\n{"question":"Your next step?","options":["Try"]}\n```';
  const start = text.indexOf("```tutor") + "```tutor".length;
  for (let i = start; i < text.length; i++) {
    const result = parseTutorResponse(text.slice(0, i));
    assert.equal(result.content, "One small step.");
    assert.equal(result.checkpoint, null);
  }
  assert.ok(parseTutorResponse(text).checkpoint);
});

test("malformed and oversized checkpoints never become controls", () => {
  for (const value of [
    null,
    {},
    { question: "", options: [] },
    { question: "Try", options: [42] },
    { question: "Try", options: Array(5).fill("Option") },
    { question: "x".repeat(1001), options: [] },
  ]) {
    const result = parseTutorResponse(`Teaching.\n\`\`\`tutor\n${JSON.stringify(value)}\n\`\`\``);
    assert.equal(result.checkpoint, null);
    assert.match(result.content, /Teaching/);
    assert.doesNotMatch(result.content, /```|options/);
  }
});

test("older plain text and regular code fences remain readable", () => {
  const text = "A full explanation.\n```js\nconst value = 1;\n```";
  assert.deepEqual(parseTutorResponse(text), { content: text, checkpoint: null });
});
