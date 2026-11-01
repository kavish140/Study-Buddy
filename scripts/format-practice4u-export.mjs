import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const folder = new URL("../artifacts/practice4u/", import.meta.url);
const raw = await readFile(new URL("question-bank-export.json", folder), "utf8");
const data = JSON.parse(raw);
const chapters = new Map(data.chapters.map((chapter) => [chapter.id, chapter]));
const subjects = new Map(data.subjects.map((subject) => [subject.id, subject.name]));
const exams = new Map(data.exams.map((exam) => [exam.id, exam.name]));
if (!data.questions.length || new Set(data.questions.map((q) => q.id)).size !== data.questions.length)
  throw new Error("Question export is empty or contains duplicate IDs");
const questions = data.questions.map((q) => {
  if (!q.q || q.a == null || !q.s) throw new Error(`Incomplete question: ${q.id}`);
  const chapter = chapters.get(q.ch);
  return {
    id: q.id,
    subject: subjects.get(q.sub || chapter?.sub) || null,
    chapter: q.chName || chapter?.name || q.ch,
    class: q.cls || chapter?.cls || null,
    exams: (q.ex || []).map((exam) => exams.get(exam) || exam),
    type: ({ mcq: "single_choice", multi: "multiple_choice", num: "numerical", grid: "grid" })[q.t] || q.t,
    question: q.q,
    options: q.o || [],
    answer: q.a,
    solution: q.s,
    shortcut: q.tr || null,
    hints: q.h || [],
    topic: q.topic || null,
    subtopic: q.subt || null,
    concepts: q.cc || [],
    level: q.lvl || null,
    difficulty: q.diff ?? null,
    source: q.src || null,
    paper: q.paper || null,
    original: q,
  };
});
const countBy = (key) => questions.reduce((counts, q) => {
  const value = q[key] ?? "unknown";
  counts[value] = (counts[value] || 0) + 1;
  return counts;
}, {});
await writeFile(new URL("questions.json", folder), JSON.stringify(questions, null, 2) + "\n");
const columns = ["id", "subject", "chapter", "class", "exams", "type", "question", "options", "answer", "solution", "shortcut", "hints", "topic", "subtopic", "concepts", "level", "difficulty", "source", "paper"];
const cell = (value) => '"' + String(value == null ? "" : typeof value === "object" ? JSON.stringify(value) : value).replaceAll('"', '""') + '"';
await writeFile(new URL("questions.csv", folder), "\ufeff" + [columns, ...questions.map((q) => columns.map((column) => q[column]))].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n");
const manifest = {
  source: "https://practice4u.vercel.app/",
  capturedOn: "2026-11-01",
  method: "Exported the signed-in app's loaded QALL collection using Chrome DevTools; includes built-in questions and the accessible merged bank.",
  scope: "Questions loaded by the current account. This is not a database administrator export; no claim is made about records unavailable to this account.",
  count: questions.length,
  uniqueIds: new Set(questions.map((q) => q.id)).size,
  subjects: countBy("subject"),
  types: countBy("type"),
  missingQuestion: questions.filter((q) => !q.question).length,
  missingAnswer: questions.filter((q) => q.answer == null).length,
  missingSolution: questions.filter((q) => !q.solution).length,
  rawSha256: createHash("sha256").update(raw).digest("hex"),
  answerFormat: "Preserved from the source: MCQ answers are zero-based option indices; multiple-choice answers are arrays of indices; numerical and grid answers retain their original representation.",
  rights: "Practice4U asserts copyright and restrictions on copying and sharing. No redistribution license is granted by this export.",
};
await writeFile(new URL("manifest.json", folder), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
