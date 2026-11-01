import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  bankQuiz,
  quizExamOptions,
  bankMock,
  filterBank,
  isCorrectBankAnswer,
  loadQuestionBank,
  sampleBank,
  drawBankQuestions,
  resetQuestionHistory,
  setQuestionHistoryUser,
} from "../src/lib/question-bank.ts";
import { importJEEBench, importMainPractice, importNEET } from "./question-importers.mjs";

test("quiz exam options follow the account's exam family", () => {
  for (const exam of ["jee", "jee-main", "jee-advanced"])
    assert.deepEqual(quizExamOptions(exam), ["Mixed JEE", "JEE Main", "JEE Advanced"]);
  assert.deepEqual(quizExamOptions("neet"), ["NEET UG"]);
});

const main = JSON.parse(
  await readFile(new URL("../public/question-bank/jee-main.json", import.meta.url), "utf8"),
);
const advanced = JSON.parse(
  await readFile(new URL("../public/question-bank/jee-advanced.json", import.meta.url), "utf8"),
);
const neet = JSON.parse(
  await readFile(new URL("../public/question-bank/neet.json", import.meta.url), "utf8"),
);

test("every shipped question has a traceable source and usable answer key", () => {
  assert.ok(main.length + advanced.length > 515);
  const ids = new Set();
  for (const q of [...main, ...advanced, ...neet]) {
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
  const selected = new Set();
  const reservationCalls = [];
  setQuestionHistoryUser("test-user", {
    reserve: async (groups) => {
      reservationCalls.push(groups);
      return groups.map(({ ids, count }) => {
        const picked = ids.filter((id) => !selected.has(id)).slice(0, count);
        picked.forEach((id) => selected.add(id));
        return picked;
      });
    },
    reset: async () => selected.clear(),
  });
  t.after(() => setQuestionHistoryUser(null));
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    requests.push(url);
    assert.match(url, /^\/question-bank\/(jee-main|jee-advanced|neet)\.json$/);
    return Response.json(url.includes("neet") ? neet : url.includes("advanced") ? advanced : main);
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
  assert.equal(reservationCalls.length, 2);
  assert.equal(reservationCalls[1].length, 3); // One transaction for all mock sections.
  assert.equal(mock.sections.length, 3);
  assert.ok(mock.sections.every((s) => s.questions.length === 5));
  const quizSources = new Set(quiz.questions.map((q) => q.source.original_id));
  assert.ok(
    mock.sections.flatMap((s) => s.questions).every((q) => !quizSources.has(q.source.original_id)),
  );
  assert.ok(requests.length > 0);
  assert.throws(() => sampleBank([], 5), /AI question generation is disabled/);
  assert.throws(() => sampleBank(main, NaN));
  const neetQuiz = await bankQuiz({ topic: "motion", count: 2, examName: "NEET UG" });
  assert.equal(neetQuiz.questions.length, 2);
  assert.ok(neetQuiz.questions.every((q) => /neet/i.test(q.source.original_id)));
  const neetMock = await bankMock({
    examName: "NEET UG",
    sections: ["Physics", "Chemistry", "Biology"].map((name) => ({ name, questions: 3 })),
  });
  assert.ok(neetMock.sections.every((s) => s.questions.length === 3));
  assert.ok(requests.includes("/question-bank/neet.json"));
  assert.equal((await loadQuestionBank("neet")).length, neet.length);
});

test("NEET import preserves source keys and statement lists without importing notes, mocks or generated reasoning", () => {
  const row = {
    question_id: "NEET_2023_TEST_1",
    subject: "Biology",
    question: "Choose the correct statement.",
    statements: ["A. First statement", "B. Second statement"],
    options: { a: "First", b: "Second", c: "Both", d: "Neither" },
    correct_answer_key: "c",
    brief_explanation: "Generated source reasoning",
  };
  const q = importNEET(row);
  assert.equal(q.exam_id, "neet");
  assert.equal(q.year, 2023);
  assert.match(q.question, /A\. First statement\n\nB\. Second statement/);
  assert.deepEqual(q.correct_options, [2]);
  assert.equal(q.answer, "Both");
  assert.equal(q.explanation, undefined);
  assert.equal(importNEET({ ...row, question_id: "NEET_2025_TEST_1" }), null);
  assert.equal(importNEET({ entry_id: "NCERT_XI_CH1_001", source_text: "A note" }), null);
  assert.equal(importNEET({ ...row, correct_answer_key: "e" }), null);
  assert.equal(importNEET({ ...row, statements: { A: "Missing list" } }), null);
  assert.equal(importNEET({ ...row, question: "Match List-I with List-II" }), null);
  assert.equal(
    importNEET({
      ...row,
      options: {
        a: "Statement I is incorrect.",
        b: "Statement I is false.",
        c: "Both",
        d: "Neither",
      },
    }),
    null,
  );
  assert.ok(importNEET({ ...row, options: { a: "α²", b: "α³", c: "β²", d: "β³" } }));
  assert.equal(importNEET({ ...row, question: "Consider the following figure" }), null);
  assert.equal(
    importNEET({
      ...row,
      subject: "Physics",
      question: "A system follows the cycle abcda. Find work along path bc.",
    }),
    null,
  );
  assert.equal(
    importNEET({ ...row, subject: "Chemistry", question: "Choose the correct structure." }),
    null,
  );
  assert.equal(
    importNEET({ ...row, options: { a: "Same", b: "Same", c: "Other", d: "Neither" } }),
    null,
  );
  assert.ok(neet.length > 300);
  assert.deepEqual([...new Set(neet.map((q) => q.subject))].sort(), [
    "Biology",
    "Chemistry",
    "Physics",
  ]);
  assert.ok(neet.every((q) => q.year >= 2021 && q.year <= 2024 && q.explanation === undefined));
});

test("NEET manifest counts match the shipped snapshot", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../public/question-bank/manifest.json", import.meta.url), "utf8"),
  );
  assert.equal(manifest.exams.neet.count, neet.length);
  assert.equal(manifest.count, main.length + advanced.length + neet.length);
  for (const [subject, count] of Object.entries(manifest.neetImport.subjects))
    assert.equal(neet.filter((q) => q.subject === subject).length, count);
});

test("cloud failures and invalid reservations never fall back to local sampling", async (t) => {
  t.after(() => setQuestionHistoryUser(null));
  setQuestionHistoryUser("alice", {
    reserve: async () => {
      throw new Error("Unable to sync history");
    },
    reset: async () => {
      throw new Error("Unable to reset history");
    },
  });
  await assert.rejects(drawBankQuestions(advanced, 2), /Unable to sync/);
  await assert.rejects(resetQuestionHistory(), /Unable to reset/);
  setQuestionHistoryUser("alice", {
    reserve: async () => [[advanced[0].id, advanced[0].id]],
    reset: async () => {},
  });
  await assert.rejects(drawBankQuestions(advanced, 2), /Invalid question reservation/);
  setQuestionHistoryUser("alice", { reserve: async () => [[]], reset: async () => {} });
  await assert.rejects(drawBankQuestions(advanced, 2), /Incomplete/);
  assert.deepEqual(await drawBankQuestions(advanced, 2, true), []);
});

test("old browser history migrates only after a successful server reservation", async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const key = "aceprep:question-history:v1:alice";
  const values = new Map([[key, JSON.stringify([advanced[0].id])]]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.get(key),
      removeItem: (key) => values.delete(key),
    },
  });
  t.after(() => {
    setQuestionHistoryUser(null);
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  });
  setQuestionHistoryUser("alice", {
    reserve: async () => {
      throw new Error("Offline");
    },
    reset: async () => {},
  });
  await assert.rejects(drawBankQuestions(advanced, 1), /Offline/);
  assert.ok(values.has(key));
  setQuestionHistoryUser("alice", {
    reserve: async (groups, legacy) => {
      assert.deepEqual(legacy, [advanced[0].id]);
      assert.equal(groups[0].count, 1);
      return [[advanced[1].id]];
    },
    reset: async () => {},
  });
  assert.equal((await drawBankQuestions(advanced, 1))[0].id, advanced[1].id);
  assert.ok(!values.has(key));
});

test("an account change while a reservation is pending cannot open the old account's questions", async (t) => {
  t.after(() => setQuestionHistoryUser(null));
  let resolve;
  setQuestionHistoryUser("alice", {
    reserve: () =>
      new Promise((done) => {
        resolve = done;
      }),
    reset: async () => {},
  });
  const pending = drawBankQuestions(advanced, 1);
  setQuestionHistoryUser("bob", { reserve: async () => [[advanced[0].id]], reset: async () => {} });
  resolve([[advanced[0].id]]);
  await assert.rejects(pending, /account changed/);
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
