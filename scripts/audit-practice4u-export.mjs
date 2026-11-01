import { readFile, writeFile } from "node:fs/promises";

const folder = new URL("../artifacts/practice4u/", import.meta.url);
const questions = JSON.parse(await readFile(new URL("questions.json", folder), "utf8"));
const answerAudit = JSON.parse(await readFile(new URL("answer-audit.json", folder), "utf8"));
const reviewed = new Map(answerAudit.records.map((record) => [record.id, record]));
const supported = ["JEE Main", "JEE Advanced", "NEET"];
const textKey = (q) => JSON.stringify([q.question, q.options]).normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
const groups = new Map();
for (const q of questions) {
  const key = textKey(q);
  groups.set(key, [...(groups.get(key) || []), q.id]);
}
const existing = new Set();
for (const exam of ["jee-main", "jee-advanced", "neet"]) {
  const bank = JSON.parse(await readFile(new URL(`../public/question-bank/${exam}.json`, import.meta.url), "utf8"));
  for (const q of bank) existing.add(textKey(q));
}
const records = questions.map((q) => {
  const reasons = [];
  const o = q.original;
  const exams = q.exams.filter((exam) => supported.includes(exam) &&
    (exam !== "NEET" || q.type === "single_choice") &&
    (exam !== "JEE Main" || q.type !== "multiple_choice"));
  if (!exams.length) reasons.push("no-supported-exam-and-type-pair");
  if (!["single_choice", "multiple_choice", "numerical"].includes(q.type)) reasons.push("unsupported-question-type");
  if (!q.subject || !q.question?.trim() || !q.solution?.trim()) reasons.push("missing-required-content");
  if (q.type === "single_choice" || q.type === "multiple_choice") {
    const answers = q.type === "single_choice" ? [q.answer] : q.answer;
    if (q.options.length !== 4 || q.options.some((option) => typeof option !== "string" || !option.trim())) reasons.push("invalid-options");
    if (!Array.isArray(answers) || !answers.length || answers.some((a) => !Number.isInteger(a) || a < 0 || a > 3) || new Set(answers).size !== answers.length) reasons.push("invalid-choice-answer");
    if (new Set(q.options.map((option) => option.normalize("NFKC").replace(/\s+/g, "").toLowerCase())).size !== 4) reasons.push("duplicate-options");
  }
  if (q.type === "numerical" && ((typeof q.answer !== "number" && typeof q.answer !== "string") || String(q.answer).trim() === "" || !Number.isFinite(Number(q.answer)))) reasons.push("invalid-numerical-answer");
  // Study Buddy renders Markdown/KaTeX, but does not carry these source-only fields.
  for (const field of ["fig", "sfig", "of", "para", "mm"]) {
    const value = o[field];
    if (value && (!Array.isArray(value) || value.some(Boolean))) reasons.push(`requires-${field}-rendering`);
  }
  if (/\[IMAGE\]|<img|<svg|\\includegraphics|as shown|shown (?:in|below|above)|see fig|following (?:circuit|figure|graph|diagram)|given (?:figure|circuit|diagram)|in the figure/i.test([q.question, ...q.options, q.solution].join(" ")) && !o.fig && !o.mm) reasons.push("visual-or-context-reference-needs-review");
  const duplicates = groups.get(textKey(q));
  return {
    id: q.id, subject: q.subject, chapter: q.chapter, type: q.type,
    sourceExams: q.exams, applicableExams: exams,
    status: reasons.length ? "hold" : "candidate",
    reasons,
    quizAndMockCandidate: !reasons.length && q.type === "single_choice",
    duplicateIds: duplicates.filter((id) => id !== q.id),
    exactMatchInExistingBank: existing.has(textKey(q)),
    answerAudit: reviewed.get(q.id)?.status || "not-individually-checked",
  };
});
const countBy = (rows, key) => rows.reduce((counts, q) => { counts[q[key]] = (counts[q[key]] || 0) + 1; return counts; }, {});
const candidates = records.filter((q) => q.status === "candidate");
const summary = {
  total: records.length,
  candidates: candidates.length,
  held: records.length - candidates.length,
  quizAndMockCandidates: candidates.filter((q) => q.quizAndMockCandidate).length,
  candidatesBySubject: countBy(candidates, "subject"),
  candidatesByType: countBy(candidates, "type"),
  exams: Object.fromEntries(supported.map((exam) => {
    const rows = candidates.filter((q) => q.applicableExams.includes(exam));
    return [exam, { practice: rows.length, quizAndMock: rows.filter((q) => q.quizAndMockCandidate).length }];
  })),
  holdsByReason: Object.fromEntries([...new Set(records.flatMap((q) => q.reasons))].map((reason) => [reason, records.filter((q) => q.reasons.includes(reason)).length])),
  exactDuplicateGroups: [...groups.values()].filter((ids) => ids.length > 1).length,
  redundantExactDuplicates: [...groups.values()].reduce((sum, ids) => sum + ids.length - 1, 0),
  candidateDuplicateGroups: new Set(candidates.filter((q) => q.duplicateIds.length).map((q) => [q.id, ...q.duplicateIds].sort().join("|"))).size,
  candidateExactMatchesInExistingBank: candidates.filter((q) => q.exactMatchInExistingBank).length,
  caveat: "Candidate means compatible after field mapping, not independently verified or approved for publication. Exam tags overlap; do not add exam counts. Visual/context holds are conservative. PYQ labels are source claims, not independently confirmed paper provenance.",
};
await writeFile(new URL("study-buddy-eligibility.json", folder), JSON.stringify({ summary, records }, null, 2) + "\n");
await writeFile(new URL("study-buddy-candidates.json", folder), JSON.stringify(questions.filter((q) => candidates.some((c) => c.id === q.id)), null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
