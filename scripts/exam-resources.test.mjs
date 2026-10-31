import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EXAM_RESOURCES, resourcesForExam } from "../src/lib/exam-resources.ts";
import { examIdFromName, bankQuiz, bankMock } from "../src/lib/question-bank.ts";
import { getExamById } from "../src/lib/exam-catalog.ts";

test("each non-JEE exam has publisher materials and a question-bank entry", () => {
  for (const exam of ["cbse-class-10", "neet", "upsc-prelims", "sat", "gre"]) {
    const resources = resourcesForExam(exam);
    assert.ok(resources.some((r) => r.kind === "study-material"));
    assert.ok(resources.some((r) => r.kind === "question-bank"));
    assert.ok(resources.every((r) => r.publisher && r.description && r.subjects.length));
  }
  assert.equal(new Set(EXAM_RESOURCES.map((r) => r.id)).size, EXAM_RESOURCES.length);
  for (const r of EXAM_RESOURCES) {
    for (const value of [r.url, r.evidenceUrl]) {
      const url = new URL(value);
      assert.equal(url.protocol, "https:");
      assert.match(
        url.hostname,
        /(^|\.)(cbseacademic\.nic\.in|cbse\.gov\.in|ncert\.nic\.in|epathshala\.nic\.in|sathee\.iitk\.ac\.in|iitk\.ac\.in|nta\.nic\.in|nta\.ac\.in|upsc\.gov\.in|collegeboard\.org|ets\.org)$/,
      );
    }
    if (r.kind === "past-paper") assert.ok(r.year && r.format === "pdf");
  }
});

test("the downloadable catalog matches the app data", async () => {
  const exported = JSON.parse(
    await readFile(new URL("../public/study-resources.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(exported.resources, EXAM_RESOURCES);
  assert.equal(exported.count, EXAM_RESOURCES.length);
});

test("non-JEE names resolve correctly and never silently select a JEE quiz", async () => {
  for (const [name, id] of [
    ["CBSE Class 10 Board Exam", "cbse-class-10"],
    ["Grade 10 CBSE Board Exam", "cbse-class-10"],
    ["CBSE Class X", "cbse-class-10"],
    ["cbse-class-10", "cbse-class-10"],
    ["NEET UG", "neet"],
    ["UPSC Civil Services Prelims", "upsc-prelims"],
    ["SAT", "sat"],
    ["GRE General Test", "gre"],
  ]) {
    assert.equal(examIdFromName(name), id);
    if (id === "neet") continue; // NEET now has an imported bank; exercised by question-bank tests.
    await assert.rejects(bankQuiz({ topic: "", count: 5, examName: name }), /not imported/);
    await assert.rejects(
      bankMock({ examName: name, sections: [{ name: "Math", questions: 5 }] }),
      /not imported/,
    );
  }
  assert.equal(examIdFromName("Mixed JEE"), "jee");
  assert.equal(examIdFromName("JEE Advanced"), "jee-advanced");
  assert.equal(examIdFromName("JEE Main"), "jee-main");
  assert.equal(examIdFromName("Unknown main examination"), "");
  assert.equal(examIdFromName("CBSE Class 12"), "");
});

test("CBSE core courses have official practice and matching current sample marking schemes", () => {
  const exam = getExamById("cbse-class-10");
  assert.ok(exam);
  assert.match(exam.examPattern.summary, /Separate subject papers/);
  const resources = resourcesForExam(exam.id);
  for (const subject of exam.subjects) {
    assert.ok(subject.topics.length > 0);
    assert.ok(
      resources.some((r) => r.subjects.includes(subject.name) && r.kind === "question-bank"),
    );
  }
  for (const paper of resources.filter((r) => r.id.startsWith("cbse-10-sqp-2027-"))) {
    const scheme = resources.find((r) => r.id === paper.id.replace("-sqp-", "-ms-"));
    assert.equal(scheme?.kind, "answer-key");
    assert.deepEqual(scheme.subjects, paper.subjects);
    assert.equal(scheme.url, paper.url.replace("-SQP.pdf", "-MS.pdf"));
  }
  for (const r of resources) {
    for (const value of [r.url, r.evidenceUrl]) {
      assert.match(
        new URL(value).hostname,
        /(^|\.)(cbseacademic\.nic\.in|cbse\.gov\.in|ncert\.nic\.in|epathshala\.nic\.in)$/,
      );
    }
  }
});
