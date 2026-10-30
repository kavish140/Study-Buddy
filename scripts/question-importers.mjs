import { createHash } from "node:crypto";

export const SOURCES = {
  jeebench: {
    name: "JEEBench · IIT Delhi DAIR",
    url: "https://huggingface.co/datasets/daman1209arora/jeebench",
    license: "MIT",
    revision: "d070d1113ce365df05903763a2017ec2d0d56118",
    kind: "pyq",
    evidence: "Author-curated JEE Advanced exam questions and answer keys",
  },
  pw: {
    name: "Physics Wallah AI · JEE Main 2025 Mathematics",
    url: "https://huggingface.co/datasets/PhysicsWallahAI/JEE-Main-2025-Math",
    license: "Apache-2.0",
    revision: "da0f8cb21ff63d4e56d8f06136e9cafdd817d2f8",
    kind: "pyq",
    evidence: "Publisher states answers were cross-checked against NTA final keys",
  },
  mainPractice: {
    name: "JEE Main practice collection · eQOURSE / soughed",
    url: "https://huggingface.co/datasets/soughed/jee-main-questions",
    license: "CC-BY-4.0",
    revision: "e921b1f63dc02e655457146f37737900ff1c0700",
    kind: "practice",
    evidence: "Community collection; exam years and official-paper provenance unverified",
  },
};

export function cleanText(value = "") {
  return String(value)
    .replace(/\\begin\{center\}|\\end\{center\}/g, "")
    .replace(/\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g, (_all, body) => {
      const rows = body
        .replace(/\\hline/g, "")
        .split(/\\\\/)
        .map((row) =>
          row
            .trim()
            .replace(/\|/g, "\\|")
            .replace(/\s*&\s*/g, " | "),
        )
        .filter(Boolean);
      if (!rows.length) return "";
      const divider = rows[0]
        .split(/(?<!\\)\|/)
        .map(() => "---")
        .join(" | ");
      return (
        "\n\n" + [rows[0], divider, ...rows.slice(1)].map((row) => `| ${row} |`).join("\n") + "\n\n"
      );
    })
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function finish(question, source, originalId) {
  if (!question.subject || !question.answer?.trim()) return null;
  if (
    !question.question ||
    /\[IMAGE\]|<img|\\includegraphics|!\[[^\]]*\]\(|as shown|shown (?:in|below|above)|following (?:circuit|figure|graph|diagram)|given (?:figure|circuit|diagram)|in the figure/i.test(
      question.question + (question.options ?? []).join(" "),
    )
  )
    return null;
  if (
    question.question_type !== "integer" &&
    (question.options?.length !== 4 || question.options.some((o) => !o))
  )
    return null;
  if (
    question.question_type !== "integer" &&
    (!question.correct_options.length ||
      question.correct_options.some((i) => !Number.isInteger(i) || i < 0 || i > 3))
  )
    return null;
  if (question.question_type === "mcq" && question.correct_options.length !== 1) return null;
  if (
    question.options.length &&
    new Set(question.options.map((o) => o.replace(/\s+/g, "").toLowerCase())).size !== 4
  )
    return null;
  if (question.question_type === "integer" && !Number.isFinite(Number(question.answer)))
    return null;
  if (/\[IMAGE\]|<img/i.test(question.explanation ?? "")) question.explanation = undefined;
  const fingerprint = createHash("sha256")
    .update(question.exam_id + question.question.replace(/\s+/g, " ").toLowerCase())
    .digest("hex")
    .slice(0, 20);
  return {
    ...question,
    id: `bank-${fingerprint}`,
    source: { ...source, original_id: String(originalId) },
    tags: [question.subject, question.topic].filter(Boolean),
  };
}

export function importJEEBench(row) {
  const type = row.type === "MCQ" ? "mcq" : row.type === "MCQ(multiple)" ? "multiple" : "integer";
  const full = cleanText(row.question);
  const matches = [...full.matchAll(/(?:^|\n)\s*\(([ABCD])\)\s*/g)];
  if (type !== "integer" && (matches.length !== 4 || matches.map((m) => m[1]).join("") !== "ABCD"))
    return null;
  const options =
    type === "integer"
      ? []
      : matches.map((m, i) =>
          full.slice(m.index + m[0].length, matches[i + 1]?.index ?? full.length).trim(),
        );
  const indices =
    type === "integer"
      ? []
      : [...String(row.gold).matchAll(/[ABCD]/g)].map((m) => m[0].charCodeAt(0) - 65);
  return finish(
    {
      exam_id: "jee-advanced",
      year: Number(row.description.match(/20\d{2}/)?.[0]) || null,
      subject: { phy: "Physics", chem: "Chemistry", math: "Mathematics" }[row.subject],
      topic: "",
      question: type === "integer" ? full : full.slice(0, matches[0].index).trim(),
      question_type: type,
      options,
      correct_options: indices,
      answer: type === "integer" ? String(row.gold) : indices.map((i) => options[i]).join("; "),
      difficulty: null,
    },
    SOURCES.jeebench,
    `${row.description}-${row.subject}-${row.index}`,
  );
}

export function importMainPractice(row) {
  if (row.question_images?.length || row.has_image) return null;
  const numeric = row.question_type === "numerical";
  if (numeric ? row.numerical_answer == null : row.correct_option == null) return null;
  const options = numeric ? [] : [1, 2, 3, 4].map((i) => cleanText(row[`option_${i}`]));
  const index = Number(row.correct_option) - 1;
  return finish(
    {
      exam_id: "jee-main",
      year: null,
      subject: row.subject,
      topic: [row.topic, row.subtopic].filter(Boolean).join(" · "),
      question: cleanText(row.question),
      question_type: numeric ? "integer" : "mcq",
      options,
      correct_options: numeric ? [] : [index],
      answer: numeric ? String(row.numerical_answer) : options[index],
      explanation: cleanText(row.solution),
      difficulty:
        { easy: "easy", moderate: "medium", tough: "hard", hard: "hard" }[
          row.difficulty?.toLowerCase()
        ] ?? null,
    },
    SOURCES.mainPractice,
    row.question_id,
  );
}

export function importPW(row, source, index) {
  const numeric = Number(row.question_type) === 0;
  const options = numeric
    ? []
    : (row.options ?? []).map((o) =>
        cleanText(typeof o === "string" ? o : (o.text ?? o.option ?? "")),
      );
  const indices = numeric ? [] : (row.correct_options ?? []).map(Number);
  return finish(
    {
      exam_id: "jee-main",
      year: 2025,
      subject: "Mathematics",
      topic: "",
      question: cleanText(row.question),
      question_type: numeric ? "integer" : indices.length > 1 ? "multiple" : "mcq",
      options,
      correct_options: indices,
      answer: numeric ? String(row.answer) : indices.map((i) => options[i]).join("; "),
      difficulty: null,
    },
    source,
    index,
  );
}
