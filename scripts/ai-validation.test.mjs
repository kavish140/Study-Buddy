import test from "node:test";
import assert from "node:assert/strict";
import { validateAIResult } from "../src/lib/ai-validation.ts";

test("AI outputs only validated notes, syllabus parsing and study plans", () => {
  for (const action of ["generateNotes", "parseSyllabus", "generatePlan"])
    assert.throws(() => validateAIResult(action, {}));
  assert.throws(() => validateAIResult("generatePlan", { plan: [{ day: 0, tasks: ["Study"] }] }));
  assert.deepEqual(
    validateAIResult("generateNotes", {
      summary: "A useful summary",
      flashcards: [{ q: "Invented", a: "Not allowed" }],
    }),
    { summary: "A useful summary" },
  );
});
