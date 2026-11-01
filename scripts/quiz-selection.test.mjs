import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectQuiz } from "../src/lib/quiz-selection.ts";
import { structuredTopicMatches, resolveTopic } from "../src/lib/quiz-search.ts";
import { validateGeneratedQuestions } from "../supabase/functions/_shared/quiz-validation.ts";

const bank = [
  {
    id: "bond",
    subject: "Chemistry",
    topic: "",
    tags: [],
    question: "Identify the molecular geometry and bond angle.",
    options: ["a", "b", "c", "d"],
    question_type: "mcq",
    correct_options: [2],
    answer: "c",
    difficulty: "easy",
    source: { name: "Bank", url: "https://example.com" },
  },
  {
    id: "semantic",
    subject: "Chemistry",
    topic: "",
    tags: [],
    question: "Which orbital overlap occurs in this molecule?",
    options: ["a", "b", "c", "d"],
    question_type: "mcq",
    correct_options: [1],
    answer: "b",
    difficulty: "hard",
    source: { name: "Bank", url: "https://example.com" },
  },
];
const generated = {
  question: "Which arrangement minimizes electron pair repulsion?",
  options: ["Linear", "Bent", "Tetrahedral", "Square planar"],
  answerIndex: 0,
  explanation: "The two electron domains separate by 180 degrees.",
};
const request = { topic: "chemical bonding", count: 1, examName: "Mixed JEE" };
const convert = (q) => ({
  question: q.question,
  options: q.options,
  answerIndex: q.correct_options[0],
  explanation: q.answer,
  source: q.source,
});
function fixture(overrides = {}) {
  return {
    load: async () => bank,
    reserve: async (items, count) => items.slice(0, count),
    convert,
    select: async () => {
      throw new Error("Unexpected selection");
    },
    generate: async () => {
      throw new Error("Unexpected generation");
    },
    ...overrides,
  };
}

test("structured aliases, minor typos and subject boundaries match real bank questions", async () => {
  assert.equal(resolveTopic("chemicl bonding")[0], "Chemical Bonding");
  assert.equal(resolveTopic("vsepr")[0], "Chemical Bonding");
  assert.equal(resolveTopic("qzxvbnmlkj"), undefined);
  assert.equal(structuredTopicMatches(bank, "chemical bonding").length, 1);
  assert.equal(
    structuredTopicMatches([{ ...bank[0], subject: "Physics" }], "chemical bonding").length,
    0,
  );
  assert.equal(structuredTopicMatches(bank, "bonding nonsense").length, 0);
  const real = JSON.parse(
    await readFile(new URL("../public/question-bank/jee-advanced.json", import.meta.url), "utf8"),
  );
  assert.ok(structuredTopicMatches(real, "chemical bonding").length > 0);
});

test("local matching avoids AI and preserves source answer keys", async () => {
  const result = await selectQuiz(request, fixture());
  assert.equal(result.questions[0].answerIndex, 2);
  assert.equal(result.questions[0].source.name, "Bank");
  assert.equal(result.questions[0].origin, undefined);
});

test("semantic fallback selects only existing questions and fills the requested count", async () => {
  const result = await selectQuiz(
    { ...request, count: 2 },
    fixture({
      select: async ({ candidates }) => {
        assert.deepEqual(
          candidates.map((q) => q.id),
          ["semantic"],
        );
        return { valid: true, topic: "Chemical Bonding", ids: ["semantic"] };
      },
    }),
  );
  assert.deepEqual(
    result.questions.map((q) => q.answerIndex),
    [2, 1],
  );
});

test("only content shortages trigger generation, marked without a fabricated source", async () => {
  const result = await selectQuiz(
    { ...request, count: 2 },
    fixture({
      select: async () => ({ valid: true, topic: "Chemical Bonding", ids: [] }),
      generate: async (data) => {
        assert.equal(data.count, 1);
        return { questions: [generated] };
      },
    }),
  );
  assert.equal(result.questions.length, 2);
  assert.equal(result.questions[1].origin, "generated");
  assert.equal(result.questions[1].source, undefined);
});

test("invalid or gibberish topics never generate questions", async () => {
  let generated = false;
  const deps = fixture({
    select: async () => ({ valid: false, topic: "", ids: [] }),
    generate: async () => {
      generated = true;
    },
  });
  await assert.rejects(selectQuiz({ ...request, topic: "qzxvbnmlkj" }, deps), /exam syllabus/);
  await assert.rejects(selectQuiz({ ...request, topic: "1111111111" }, deps), /recognizable/);
  assert.equal(generated, false);
});

test("bank, history and service failures stop the cascade", async () => {
  for (const overrides of [
    {
      load: async () => {
        throw new Error("offline");
      },
    },
    {
      reserve: async () => {
        throw new Error("offline");
      },
    },
    {
      select: async () => {
        throw new Error("offline");
      },
    },
  ])
    await assert.rejects(selectQuiz({ ...request, count: 2 }, fixture(overrides)), /offline/);
});

test("fabricated bank IDs, duplicate generated questions and invalid answer keys are rejected", async () => {
  await assert.rejects(
    selectQuiz(
      { ...request, count: 2 },
      fixture({
        select: async () => ({ valid: true, topic: "Chemical Bonding", ids: ["invented"] }),
      }),
    ),
    /invalid bank selections/,
  );
  for (const q of [
    { ...generated, answerIndex: 4 },
    { ...generated, answerIndex: "0" },
    { ...generated, options: ["a", "a", "b", "c"] },
    { ...generated, explanation: "" },
  ])
    assert.throws(() => validateGeneratedQuestions({ questions: [q] }, 1));
  assert.throws(
    () => validateGeneratedQuestions({ questions: [generated, generated] }, 2),
    /duplicate/,
  );
});

test("difficulty stays strict and blank mixed practice never generates", async () => {
  await assert.rejects(
    selectQuiz({ ...request, topic: "", count: 3 }, fixture()),
    /unseen bank questions/,
  );
  const result = await selectQuiz(
    { ...request, difficulty: "hard" },
    fixture({
      select: async ({ candidates }) => {
        assert.deepEqual(
          candidates.map((q) => q.id),
          ["semantic"],
        );
        return { valid: true, topic: "Chemical Bonding", ids: ["semantic"] };
      },
    }),
  );
  assert.equal(result.questions[0].answerIndex, 1);
});
