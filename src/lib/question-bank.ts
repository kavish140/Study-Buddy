export type BankQuestion = {
  id: string;
  exam_id: string;
  year: number | null;
  subject: string;
  topic: string;
  question: string;
  question_type: "mcq" | "multiple" | "integer";
  options: string[];
  correct_options: number[];
  answer: string;
  explanation?: string;
  difficulty: "easy" | "medium" | "hard" | null;
  tags: string[];
  source: {
    name: string;
    url: string;
    license: string;
    kind: string;
    original_id: string;
    evidence: string;
  };
};

const cache = new Map<string, Promise<BankQuestion[]>>();
export function loadQuestionBank(examId: string): Promise<BankQuestion[]> {
  if (examId === "jee")
    return Promise.all([loadQuestionBank("jee-main"), loadQuestionBank("jee-advanced")]).then(
      (banks) => banks.flat(),
    );
  if (!["jee-main", "jee-advanced"].includes(examId)) return Promise.resolve([]);
  if (!cache.has(examId)) {
    const pending = fetch(`/question-bank/${examId}.json`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error("The question bank could not be loaded. Please try again.");
        return (await response.json()) as BankQuestion[];
      })
      .catch((error) => {
        cache.delete(examId);
        throw error;
      });
    cache.set(examId, pending);
  }
  return cache.get(examId)!;
}

export function filterBank(
  questions: BankQuestion[],
  filter: {
    subject?: string;
    search?: string;
    year?: number;
    difficulty?: string;
    pyqOnly?: boolean;
    mcqOnly?: boolean;
  } = {},
) {
  const words = (filter.search ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(
      (word) => word.length > 2 && !["the", "and", "for", "with", "from", "laws"].includes(word),
    );
  return questions.filter(
    (q) =>
      (!filter.subject || q.subject === filter.subject) &&
      (!filter.year || q.year === filter.year) &&
      (!filter.difficulty || filter.difficulty === "any" || q.difficulty === filter.difficulty) &&
      (!filter.pyqOnly || q.source.kind === "pyq") &&
      (!filter.mcqOnly || q.question_type === "mcq") &&
      (!words.length ||
        words.some((word) => `${q.topic} ${q.subject} ${q.question}`.toLowerCase().includes(word))),
  );
}

export function sampleBank(questions: BankQuestion[], count: number) {
  if (!Number.isInteger(count) || count < 1)
    throw new Error("Choose a positive whole number of questions.");
  if (questions.length < count)
    throw new Error(
      `The bank has ${questions.length} matching questions; ${count} requested. Broaden the topic or filters, or choose fewer questions. AI question generation is disabled.`,
    );
  const pool = [...questions];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function examIdFromName(name = "") {
  return /mixed/i.test(name) && /jee/i.test(name)
    ? "jee"
    : /advanced/i.test(name)
      ? "jee-advanced"
      : /jee|main/i.test(name)
        ? "jee-main"
        : "";
}

export function toQuizQuestion(q: BankQuestion) {
  if (q.question_type !== "mcq")
    throw new Error("This question type needs the full question-bank practice mode.");
  return {
    question: q.question,
    options: q.options,
    answerIndex: q.correct_options[0],
    explanation: q.explanation || `Answer key: ${q.answer}. Source: ${q.source.name}.`,
    topic: q.topic || q.subject,
    source: q.source,
  };
}

export async function bankQuiz(data: {
  topic: string;
  count: number;
  difficulty?: string;
  examName?: string;
}) {
  const all = await loadQuestionBank(examIdFromName(data.examName || "JEE Main"));
  return {
    questions: sampleBank(
      filterBank(all, { search: data.topic, difficulty: data.difficulty, mcqOnly: true }),
      data.count,
    ).map(toQuizQuestion),
  };
}

export async function bankMock(data: {
  examName: string;
  sections: { name: string; questions: number }[];
}) {
  const bank = await loadQuestionBank(examIdFromName(data.examName));
  if (!data.sections.length) throw new Error("Select at least one subject for this mock test.");
  return {
    sections: data.sections.map((section) => ({
      name: section.name,
      questions: sampleBank(
        filterBank(bank, { subject: section.name, mcqOnly: true }),
        section.questions,
      ).map(toQuizQuestion),
    })),
  };
}

export const getQuizQuestions = ({
  data,
}: {
  data: {
    topic: string;
    count: number;
    difficulty?: string;
    examName?: string;
    source?: string;
    appContext?: string;
  };
}) => bankQuiz(data);
export const getMockTestQuestions = ({
  data,
}: {
  data: {
    examName: string;
    sections: { name: string; questions: number; topics?: string[] }[];
    source?: string;
    appContext?: string;
  };
}) => bankMock(data);

export function isCorrectBankAnswer(q: BankQuestion, selected: number[], numeric = "") {
  if (q.question_type === "integer")
    return (
      numeric.trim() !== "" &&
      Number.isFinite(Number(numeric)) &&
      Math.abs(Number(numeric) - Number(q.answer)) < 0.000001
    );
  return (
    selected.length === q.correct_options.length &&
    q.correct_options.every((i) => selected.includes(i))
  );
}
