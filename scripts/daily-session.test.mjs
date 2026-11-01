import test from "node:test";
import assert from "node:assert/strict";
import { accuracyComparison, dailySessionInputs, sessionBudget } from "../src/lib/daily-session.ts";

test("accuracy comparisons recognize topic aliases used by the question bank", () => {
  assert.deepEqual(
    accuracyComparison(
      [{ subject: "Physics", topic: "Laws of Motion", correct: 1, total: 5 }],
      [{ subject: "Physics", topic: "Newton’s laws", correct: true }],
    ),
    { before: 20, after: 100, count: 1 },
  );
});

test("session budgets scale with available time", () => {
  assert.deepEqual([15, 30, 60].map(sessionBudget), [
    { cards: 3, questions: 3 },
    { cards: 5, questions: 5 },
    { cards: 8, questions: 10 },
  ]);
});

test("prioritizes oldest due cards and unfinished overdue tasks; excludes future work", () => {
  const result = dailySessionInputs(
    "2026-11-01",
    [
      { id: "today", next_review: "2026-11-01" },
      { id: "later", next_review: "2026-11-02" },
      { id: "overdue", next_review: "2026-10-20" },
    ],
    [
      { id: "done", date: "2026-10-01", done: true },
      { id: "today", date: "2026-11-01", done: false },
      { id: "overdue", date: "2026-10-31", done: false },
    ],
    [],
    [],
    [],
  );
  assert.deepEqual(
    result.cards.map((c) => c.id),
    ["overdue", "today"],
  );
  assert.equal(result.task.id, "overdue");
});

test("uses latest topic logs over duplicate mock history and ranks weaker topics first", () => {
  const result = dailySessionInputs(
    "2026-11-01",
    [],
    [],
    [
      { subject: "Physics", topic: "Forces", correct_count: 2, question_count: 5 },
      { subject: "Chemistry", topic: "Bonds", correct_count: 1, question_count: 5 },
      { subject: "Physics", topic: "Waves", correct_count: 4, question_count: 5 },
    ],
    [
      {
        status: "completed",
        sections: [{ name: "Physics", questions: [{ id: "1", topic: "Forces", answerIndex: 0 }] }],
        answers: { 1: 0 },
      },
    ],
    [],
  );
  assert.deepEqual(
    result.weakTopics.map((t) => t.topic),
    ["Bonds", "Forces"],
  );
  assert.equal(result.baseline.find((t) => t.topic === "Forces").total, 5);
});

test("aggregates quiz baseline without counting unfinished quizzes or daily-session labels", () => {
  const result = dailySessionInputs(
    "2026-11-01",
    [],
    [],
    [],
    [],
    [
      { topic: "Forces", score: 1, questions: [1, 2] },
      { topic: "Forces", score: 0, questions: [1, 2] },
      { topic: "Unfinished", questions: [1] },
      { topic: "Daily session", score: 0, questions: [1] },
    ],
  );
  assert.equal(result.baseline.length, 1);
  assert.deepEqual(result.baseline[0], { subject: "", topic: "Forces", correct: 1, total: 4 });
});

test("compares matching topic mix only; no history does not imply improvement", () => {
  const old = [{ subject: "Physics", topic: "Forces", correct: 1, total: 4 }];
  assert.equal(
    accuracyComparison(old, [{ subject: "Chemistry", topic: "Bonds", correct: true }]),
    null,
  );
  assert.deepEqual(
    accuracyComparison(old, [
      { subject: "Physics", topic: "Forces", correct: true },
      { subject: "Physics", topic: "Forces", correct: false },
    ]),
    { before: 25, after: 50, count: 2 },
  );
});
