import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  bankQuiz,
  bankMock,
  filterBank,
  isCorrectBankAnswer,
  loadQuestionBank,
  sampleBank,
  createQuestionRotation,
  setQuestionHistoryUser,
} from "../src/lib/question-bank.ts";
import { importJEEBench, importMainPractice } from "./question-importers.mjs";

const main = JSON.parse(
  await readFile(new URL("../public/question-bank/jee-main.json", import.meta.url), "utf8"),
);
const advanced = JSON.parse(
  await readFile(new URL("../public/question-bank/jee-advanced.json", import.meta.url), "utf8"),
);

test("every shipped question has a traceable source and usable answer key", () => {
  assert.ok(main.length + advanced.length > 515);
  const ids = new Set();
  for (const q of [...main, ...advanced]) {
    assert.ok(!ids.has(q.id));
    ids.add(q.id);
    assert.ok(q.source.original_id && q.source.url.startsWith("https://") && q.source.license);
    assert.ok(q.question.trim() && q.answer.trim() && q.subject);
    assert.doesNotMatch(q.question + q.options.join(" "), /\[IMAGE\]|<img|\\includegraphics/i);
    if (q.question_type === "integer") assert.ok(Number.isFinite(Number(q.answer)));
    else {
      assert.equal(q.options.length, 4);
      assert.ok(q.correct_options.every((i) => Number.isInteger(i) && i >= 0 && i < 4));
      if (q.question_type === "mcq") assert.equal(q.correct_options.length, 1);
    }
    if (q.source.kind === "practice") assert.equal(q.year, null);
  }
});

test("quizzes and mocks only fetch static question-bank files, with no AI fallback", async (t) => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  });
  setQuestionHistoryUser("test-user");
  t.after(() => {
    setQuestionHistoryUser(null);
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else delete globalThis.localStorage;
  });
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    requests.push(url);
    assert.match(url, /^\/question-bank\/jee-(main|advanced)\.json$/);
    return Response.json(url.includes("advanced") ? advanced : main);
  });
  const quiz = await bankQuiz({
    topic: "Physics",
    count: 5,
    examName: "Mixed JEE",
    difficulty: "any",
  });
  assert.equal(quiz.questions.length, 5);
  assert.ok(quiz.questions.every((q) => q.source && q.options[q.answerIndex]));
  const mock = await bankMock({
    examName: "Mixed JEE",
    sections: ["Physics", "Chemistry", "Mathematics"].map((name) => ({ name, questions: 5 })),
  });
  assert.equal(mock.sections.length, 3);
  assert.ok(mock.sections.every((s) => s.questions.length === 5));
  const quizSources = new Set(quiz.questions.map((q) => q.source.original_id));
  assert.ok(
    mock.sections.flatMap((s) => s.questions).every((q) => !quizSources.has(q.source.original_id)),
  );
  assert.ok(requests.length > 0);
  assert.throws(() => sampleBank([], 5), /AI question generation is disabled/);
  assert.throws(() => sampleBank(main, NaN));
  assert.deepEqual(await loadQuestionBank("neet"), []);
});

test("selection history survives reload, is account-scoped, and never silently recycles", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const pool = advanced.slice(0, 12);
  const first = createQuestionRotation(storage, "alice").draw([{ questions: pool, count: 5 }])[0];
  const reloaded = createQuestionRotation(storage, "alice");
  const second = reloaded.draw([{ questions: pool, count: 5 }])[0];
  assert.equal(new Set([...first, ...second].map((q) => q.id)).size, 10);
  assert.equal(reloaded.unseen(pool).length, 2);
  const beforeFailure = new Map(values);
  assert.throws(() => reloaded.draw([{ questions: pool, count: 3 }]), /Only 2 unseen/);
  assert.deepEqual(values, beforeFailure);
  assert.equal(createQuestionRotation(storage, "bob").unseen(pool).length, 12);
  reloaded.reset();
  assert.equal(reloaded.unseen(pool).length, 12);
});

test("mock reservations are atomic and overlapping sections cannot duplicate questions", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const rotation = createQuestionRotation(storage, "alice");
  const pool = advanced.slice(0, 10);
  assert.throws(
    () =>
      rotation.draw([
        { questions: pool, count: 5 },
        { questions: pool, count: 6 },
      ]),
    /unseen/,
  );
  assert.equal(rotation.unseen(pool).length, 10);
  const groups = rotation.draw([
    { questions: pool, count: 5 },
    { questions: pool, count: 5 },
  ]);
  assert.equal(new Set(groups.flat().map((q) => q.id)).size, 10);
  const broken = createQuestionRotation({ getItem: () => "{invalid", setItem: () => {} }, "alice");
  assert.throws(() => broken.draw([{ questions: pool, count: 1 }]));
  const full = createQuestionRotation(
    {
      getItem: () => null,
      setItem: () => {
        throw new Error("Storage full");
      },
    },
    "alice",
  );
  assert.throws(() => full.draw([{ questions: pool, count: 1 }]), /Storage full/);
});

test("numerical and multi-answer practice grades against source answers", () => {
  const numeric = advanced.find((q) => q.question_type === "integer");
  assert.equal(isCorrectBankAnswer(numeric, [], numeric.answer), true);
  assert.equal(isCorrectBankAnswer(numeric, [], ""), false);
  const multi = advanced.find((q) => q.question_type === "multiple");
  assert.equal(isCorrectBankAnswer(multi, [...multi.correct_options].reverse()), true);
  assert.equal(isCorrectBankAnswer(multi, []), false);
  assert.ok(filterBank(main, { pyqOnly: true }).every((q) => q.source.kind === "pyq"));
});

test("importers reject missing diagrams and answers instead of fabricating content", () => {
  assert.equal(
    importMainPractice({
      question: "Find the current in the following circuit",
      question_type: "single_correct",
      correct_option: 1,
      subject: "Physics",
      option_1: "1",
      option_2: "2",
      option_3: "3",
      option_4: "4",
    }),
    null,
  );
  assert.equal(
    importMainPractice({
      question: "[IMAGE] Find x",
      question_type: "numerical",
      numerical_answer: "3",
    }),
    null,
  );
  assert.equal(importMainPractice({ question: "No key", question_type: "single_correct" }), null);
  assert.equal(
    importJEEBench({
      type: "MCQ",
      description: "JEE Adv 2020",
      question: "Incomplete",
      gold: "A",
      subject: "phy",
    }),
    null,
  );
});
