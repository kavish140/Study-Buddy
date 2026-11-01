import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importPractice4U, PRACTICE4U_SOURCE } from "./sync-practice4u-bank.mjs";
import { isCorrectBankAnswer, toQuizQuestion } from "../src/lib/question-bank.ts";

const rows = JSON.parse(
  await readFile(new URL("../data/question-sources/practice4u.json", import.meta.url), "utf8"),
);
test("Practice4U choice and numerical keys grade correctly after conversion", () => {
  const [reynolds] = importPractice4U(rows.find((q) => q.id === "jmp13-22"));
  assert.equal(reynolds.correct_options[0], 2);
  assert.equal(toQuizQuestion(reynolds).answerIndex, 2);
  assert.equal(isCorrectBankAnswer(reynolds, [2]), true);
  assert.equal(isCorrectBankAnswer(reynolds, [1]), false);
  const pins = importPractice4U(rows.find((q) => q.id === "eo-m-pc-46"));
  assert.deepEqual(new Set(pins.map((q) => q.exam_id)), new Set(["jee-main", "jee-advanced"]));
  assert.equal(new Set(pins.map((q) => q.id)).size, 2);
  for (const q of pins) {
    assert.equal(isCorrectBankAnswer(q, [], "630"), true);
    assert.equal(isCorrectBankAnswer(q, [], "629"), false);
    assert.equal(q.year, null);
    assert.equal(q.source.kind, "practice");
  }
  const multi = importPractice4U(rows.find((q) => q.id === "eo-m-md-21"));
  assert.equal(multi.length, 1);
  assert.equal(multi[0].exam_id, "jee-advanced");
  assert.equal(isCorrectBankAnswer(multi[0], [1, 2, 3]), true);
  assert.equal(isCorrectBankAnswer(multi[0], [1, 2]), false);
});

test("Practice4U rejects invalid answers and unsupported content or exam types", () => {
  const row = rows.find((q) => q.id === "jmp13-22");
  for (const change of [
    { answer: 4 },
    { answer: -1 },
    { options: ["a", "a", "b", "c"] },
    { type: "grid" },
    { question: "Use the figure as shown below." },
    { exams: ["Foundation (IX–X)"] },
    { type: "numerical", answer: "NaN" },
    { type: "numerical", answer: 1, exams: ["NEET"] },
    { subject: "Biology", exams: ["JEE Main"] },
  ])
    assert.deepEqual(importPractice4U({ ...row, ...change }), []);
});

test("Practice4U shipped placements preserve audited boundaries and manifest counts", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../public/question-bank/manifest.json", import.meta.url), "utf8"),
  );
  const imported = [];
  const ids = new Set();
  for (const [exam, expected] of Object.entries({
    "jee-main": 3381,
    "jee-advanced": 1811,
    neet: 128,
  })) {
    const bank = JSON.parse(
      await readFile(new URL(`../public/question-bank/${exam}.json`, import.meta.url), "utf8"),
    );
    const sourceRows = bank.filter((q) => q.source.url === PRACTICE4U_SOURCE.url);
    assert.equal(sourceRows.length, expected);
    assert.equal(manifest.practice4uImport.examPlacements[exam], expected);
    for (const q of sourceRows) {
      assert.equal(q.exam_id, exam);
      assert.ok(!ids.has(q.id));
      ids.add(q.id);
      assert.equal(q.source.kind, "practice");
      assert.equal(q.year, null);
      if (exam === "neet") assert.equal(q.question_type, "mcq");
      if (exam === "jee-main") assert.notEqual(q.question_type, "multiple");
      assert.ok(!["jmp06-43", "jadv-m-s1-20", "ea-ut2-4.i"].includes(q.source.original_id));
    }
    imported.push(...sourceRows);
  }
  assert.equal(new Set(imported.map((q) => q.source.original_id)).size, 3679);
});
