import test from "node:test";
import assert from "node:assert/strict";
import { parseTutorTools, tutorToolTarget } from "../src/lib/tutor-tools.ts";
import { parseTutorResponse } from "../src/lib/tutor-interaction.ts";

test("tool controls preserve teaching and checkpoints and encode topic handoff", () => {
  const result = parseTutorTools(
    'Try practice.\n```tutor-tools\n[{"tool":"quiz","topic":"Forces & motion"},{"tool":"review"}]\n```\n```tutor\n{"question":"Ready?","options":[]}\n```',
  );
  assert.equal(result.actions.length, 2);
  assert.deepEqual(tutorToolTarget(result.actions[0]), {
    to: "/quiz",
    search: { topic: "Forces & motion" },
  });
  assert.deepEqual(tutorToolTarget(result.actions[1]), { to: "/review", search: {} });
  const parsed = parseTutorResponse(result.content);
  assert.equal(parsed.content, "Try practice.");
  assert.equal(parsed.checkpoint.question, "Ready?");
});

test("stream fragments do not expose JSON or actionable tools", () => {
  const content = 'Next step.\n```tutor-tools\n[{"tool":"notes","topic":"Atoms"}]\n```';
  for (let i = content.indexOf("```tutor-tools") + 14; i < content.length; i++) {
    const result = parseTutorTools(content.slice(0, i));
    assert.equal(result.content, "Next step.");
    assert.deepEqual(result.actions, []);
  }
});

test("unknown tools, URLs, malformed payloads and oversized topics never become controls", () => {
  for (const payload of [
    "{",
    "null",
    "{}",
    '[{"tool":"__proto__"}]',
    '[{"tool":"https://evil.example"}]',
    '[{"tool":"delete_account"}]',
    JSON.stringify([{ tool: "quiz", topic: "x".repeat(201) }]),
    JSON.stringify(Array(4).fill({ tool: "quiz" })),
  ]) {
    const result = parseTutorTools(`Next.\n\`\`\`tutor-tools\n${payload}\n\`\`\``);
    assert.deepEqual(result.actions, []);
    assert.equal(result.content, "Next.");
  }
  const result = parseTutorTools('Next.\n```tutor-tools\n[{"tool":"quiz"},{"tool":"quiz"}]\n```');
  assert.equal(result.actions.length, 1);
  const target = tutorToolTarget({ tool: "quiz", topic: "//evil.example/?x=<script>" });
  assert.equal(target.to, "/quiz");
  assert.deepEqual(target.search, { topic: "//evil.example/?x=<script>" });
});
