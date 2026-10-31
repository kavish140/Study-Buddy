import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { SOURCES, importNEET } from "./question-importers.mjs";

export async function syncNEETBank() {
  const output = new URL("../public/question-bank/", import.meta.url);
  const source = SOURCES.neet;
  const url = `${source.url}/resolve/${source.revision}/dataset.json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`NEET source download failed: ${response.status}`);
  const text = await response.text();
  const rows = JSON.parse(text);
  const imported = rows.map(importNEET).filter(Boolean);
  const questions = [...new Map(imported.map((q) => [q.id, q])).values()];
  if (!questions.length) throw new Error("NEET import produced no usable questions");
  const manifest = JSON.parse(await readFile(new URL("manifest.json", output), "utf8"));
  manifest.updated = new Date().toISOString();
  manifest.exams.neet = { count: questions.length, mcq: questions.length };
  manifest.count = Object.values(manifest.exams).reduce((sum, exam) => sum + exam.count, 0);
  manifest.sourceCounts[source.name] = questions.length;
  manifest.sources = [...manifest.sources.filter((s) => s.url !== source.url), source];
  manifest.downloads = [...manifest.downloads.filter((d) => d.url !== url), {
    url, sha256: createHash("sha256").update(text).digest("hex"),
  }];
  manifest.neetImport = {
    input: rows.length, imported: questions.length, excluded: rows.length - imported.length,
    deduplicated: imported.length - questions.length,
    subjects: Object.fromEntries(["Physics", "Chemistry", "Biology"].map((subject) => [
      subject, questions.filter((q) => q.subject === subject).length,
    ])),
    note: "Study notes, 2025/mock records, invalid choices/keys, incomplete matching lists and circuit/diagram/graph references excluded. Generated explanations omitted. Source-supplied keys are not independently verified.",
  };
  await writeFile(new URL("neet.json", output), JSON.stringify(questions));
  const noticeFile = new URL("NOTICE.md", output);
  const notice = (await readFile(noticeFile, "utf8")).split("\n## NEET UG import\n")[0];
  await writeFile(noticeFile, `${notice.trimEnd()}\n\n## NEET UG import\n\nKshitij Gupta (Kshitij-PES), NEET Previous Year Questions for Fine-Tuning. Source: ${source.url} . Apache License 2.0, as declared in the dataset card; see LICENSE-Apache-2.0.txt.\n\nChanges: normalized choices and keys, retained statement lists, deduplicated, and excluded study notes, 2025/mock records and missing-diagram questions. Generated source explanations are omitted. Supplied answer keys have not been independently re-keyed against NTA booklets.\n`);
  await writeFile(new URL("manifest.json", output), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest.neetImport, null, 2));
  return questions.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await syncNEETBank();
