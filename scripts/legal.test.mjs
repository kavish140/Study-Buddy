import test from "node:test";
import assert from "node:assert/strict";
import { withoutInlineCredit, LEGAL_PATHS, CONTACT_EMAIL } from "../src/lib/legal.ts";
import { toQuizQuestion } from "../src/lib/question-bank.ts";

test("legacy saved credits are hidden without altering mathematical answers or unrelated citations", () => {
  assert.equal(
    withoutInlineCredit("Answer key: 4. Source: JEEBench · IIT Delhi DAIR."),
    "Answer key: 4.",
  );
  assert.equal(
    withoutInlineCredit(
      "4\n\nExplanation.\n\nSource: [JEEBench · IIT Delhi DAIR](https://huggingface.co/datasets/daman1209arora/jeebench)",
    ),
    "4\n\nExplanation.",
  );
  assert.equal(
    withoutInlineCredit("Source answer key: 4. Physics Wallah AI · JEE Main 2025 Mathematics"),
    "Source answer key: 4.",
  );
  const content = "Use $F=ma$.\n\nSource: [My reference](https://example.com/lesson)";
  assert.equal(withoutInlineCredit(content), content);
  assert.equal(
    withoutInlineCredit("JEEBench is discussed in this explanation."),
    "JEEBench is discussed in this explanation.",
  );
});

test("new practice answers retain source metadata without inline promotional credits", () => {
  const source = {
    name: "JEEBench · IIT Delhi DAIR",
    url: "https://huggingface.co/datasets/daman1209arora/jeebench",
    license: "MIT",
  };
  const question = toQuizQuestion({
    question_type: "mcq",
    question: "Find x.",
    options: ["1", "2", "3", "4"],
    correct_options: [3],
    answer: "4",
    subject: "Math",
    source,
  });
  assert.equal(question.explanation, "Answer key: 4.");
  assert.deepEqual(question.source, source);
  assert.deepEqual(LEGAL_PATHS, ["/privacy", "/terms", "/sources"]);
  assert.equal(CONTACT_EMAIL, "kavishganatra5@gmail.com");
});
