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
  drawBankQuestions,
  resetQuestionHistory,
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
  assert.deepEqual(await loadQuestionBank("neet"), []);
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
