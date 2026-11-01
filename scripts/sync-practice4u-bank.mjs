import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const PRACTICE4U_SOURCE = {
  name: "Practice4U · practice collection",
  url: "https://practice4u.vercel.app/",
  license: "All rights reserved · Practice4U",
  kind: "practice",
  evidence:
    "Signed-in collection captured 2026-11-01. Source keys retained; ten randomly selected records were spot-checked, not the full collection. Claimed paper provenance is unverified.",
};
const examIds = { "JEE Main": "jee-main", "JEE Advanced": "jee-advanced", NEET: "neet" };
const fingerprint = (q) =>
  JSON.stringify([q.question, q.options]).normalize("NFKC").replace(/\s+/g, " ").toLowerCase();

export function importPractice4U(row) {
  if (
    !row.id ||
    !row.question?.trim() ||
    !row.solution?.trim() ||
    !["Mathematics", "Physics", "Chemistry", "Biology"].includes(row.subject)
  )
    return [];
  const type = { single_choice: "mcq", multiple_choice: "multiple", numerical: "integer" }[
    row.type
  ];
  if (!type || !Array.isArray(row.options) || !Array.isArray(row.exams)) return [];
  const visual =
    /\[IMAGE\]|<img|<svg|\\includegraphics|as shown|shown (?:in|below|above)|see fig|following (?:circuit|figure|graph|diagram)|given (?:figure|circuit|diagram)|in the figure/i;
  if (visual.test([row.question, ...row.options, row.solution].join(" "))) return [];
  const answers = type === "integer" ? [] : type === "mcq" ? [row.answer] : row.answer;
  if (type === "integer") {
    if (
      !["number", "string"].includes(typeof row.answer) ||
      String(row.answer).trim() === "" ||
      !Number.isFinite(Number(row.answer))
    )
      return [];
  } else if (
    row.options.length !== 4 ||
    row.options.some((v) => typeof v !== "string" || !v.trim()) ||
    new Set(row.options.map((v) => v.normalize("NFKC").replace(/\s+/g, "").toLowerCase())).size !==
      4 ||
    !Array.isArray(answers) ||
    !answers.length ||
    new Set(answers).size !== answers.length ||
    answers.some((a) => !Number.isInteger(a) || a < 0 || a > 3)
  )
    return [];
  return [...new Set(row.exams)].flatMap((exam) => {
    const exam_id = examIds[exam];
    if (
      !exam_id ||
      (exam_id === "neet" && (type !== "mcq" || row.subject === "Mathematics")) ||
      (exam_id !== "neet" && row.subject === "Biology") ||
      (exam_id === "jee-main" && type === "multiple")
    )
      return [];
    return [
      {
        id: `p4u-${exam_id}-${createHash("sha256").update(fingerprint(row)).digest("hex").slice(0, 20)}`,
        exam_id,
        year: null,
        subject: row.subject,
        topic: row.topic || row.chapter || row.subject,
        question: row.question,
        question_type: type,
        options: type === "integer" ? [] : row.options,
        correct_options: answers,
        answer:
          type === "integer" ? String(row.answer) : answers.map((i) => row.options[i]).join("; "),
        explanation: row.solution,
        difficulty:
          { easy: "easy", med: "medium", medium: "medium", hard: "hard" }[row.difficulty] || null,
        tags: [
          ...new Set(
            [row.subject, row.chapter, row.topic, row.subtopic, ...(row.concepts || [])].filter(
              Boolean,
            ),
          ),
        ],
        source: {
          ...PRACTICE4U_SOURCE,
          original_id: row.id,
          original_label: row.source || "Practice4U original",
        },
      },
    ];
  });
}

export async function syncPractice4UBank({
  output = new URL("../public/question-bank/", import.meta.url),
  input = new URL("../data/question-sources/practice4u.json", import.meta.url),
} = {}) {
  const text = await readFile(input, "utf8");
  const rows = JSON.parse(text);
  const imported = rows.flatMap(importPractice4U);
  if (!imported.length) throw new Error("Practice4U snapshot produced no usable questions");
  const manifest = JSON.parse(await readFile(new URL("manifest.json", output), "utf8"));
  const banks = {};
  const counts = {};
  for (const exam of Object.values(examIds)) {
    const current = JSON.parse(await readFile(new URL(`${exam}.json`, output), "utf8"));
    // Replace only this source on reruns, preserving every other source and ID.
    const bank = current.filter((q) => q.source.url !== PRACTICE4U_SOURCE.url);
    const seen = new Set(bank.map(fingerprint));
    let added = 0;
    for (const q of imported.filter((q) => q.exam_id === exam)) {
      if (seen.has(fingerprint(q))) continue;
      seen.add(fingerprint(q));
      bank.push(q);
      added++;
    }
    banks[exam] = bank;
    counts[exam] = added;
  }
  manifest.updated = new Date().toISOString();
  manifest.exams = Object.fromEntries(
    Object.entries(banks).map(([exam, bank]) => [
      exam,
      {
        count: bank.length,
        mcq: bank.filter((q) => q.question_type === "mcq").length,
      },
    ]),
  );
  manifest.count = Object.values(banks).reduce((sum, bank) => sum + bank.length, 0);
  manifest.sourceCounts[PRACTICE4U_SOURCE.name] = Object.values(counts).reduce((a, b) => a + b, 0);
  manifest.sources = [
    ...manifest.sources.filter((s) => s.url !== PRACTICE4U_SOURCE.url),
    PRACTICE4U_SOURCE,
  ];
  manifest.practice4uImport = {
    captured: "2026-11-01",
    input: rows.length,
    uniqueImported: new Set(
      Object.values(banks)
        .flat()
        .filter((q) => q.source.url === PRACTICE4U_SOURCE.url)
        .map((q) => q.source.original_id),
    ).size,
    examPlacements: counts,
    inputSha256: createHash("sha256").update(text).digest("hex"),
    note: "Exam tags overlap. Imported as practice, with no claimed PYQ year. Unsupported types, figures, passages and invalid options were held by the compatibility audit. Whole-bank correctness and official-paper provenance are unverified.",
  };
  for (const [exam, bank] of Object.entries(banks))
    await writeFile(new URL(`${exam}.json`, output), JSON.stringify(bank));
  const noticeFile = new URL("NOTICE.md", output);
  const notice = (await readFile(noticeFile, "utf8")).split("\n## Practice4U import\n")[0];
  await writeFile(
    noticeFile,
    `${notice.trimEnd()}\n\n## Practice4U import\n\nPractice4U, ${PRACTICE4U_SOURCE.url} . Copyright Practice4U; all rights reserved. No open redistribution license is asserted. Captured from the user's signed-in session on 2026-11-01.\n\nChanges: filtered to supported exam/type combinations, excluded source-only visual/passage/grid content and invalid choices, converted fields and retained source-supplied keys and solutions. Records are labeled practice; claimed PYQ dates are not presented as verified provenance. Ten random records were spot-checked; this is not whole-bank verification.\n`,
  );
  await writeFile(new URL("manifest.json", output), JSON.stringify(manifest, null, 2));
  return { imported: counts, total: manifest.count, exams: manifest.exams };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await syncPractice4UBank(), null, 2));
