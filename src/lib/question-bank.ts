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

type HistoryStorage = Pick<Storage, "getItem" | "setItem">;

// One shared, account-scoped history across all question-selection tools.
// Selection reserves questions immediately, including abandoned attempts.
export function createQuestionRotation(storage: HistoryStorage, userId: string) {
  const key = `aceprep:question-history:v1:${userId}`;
  function read(): Set<string> {
    const raw = storage.getItem(key);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string"))
      throw new Error("Question history could not be read. Reset it in Question Bank to continue.");
    return new Set(parsed);
  }
  return {
    unseen(questions: BankQuestion[]) {
      const seen = read();
      return questions.filter((q) => !seen.has(q.id));
    },
    draw(groups: { questions: BankQuestion[]; count: number }[]) {
      const seen = read();
      // Reserve all groups atomically: a failed mock must not consume an earlier section.
      const selected = groups.map(({ questions, count }) => {
        const unique = [...new Map(questions.map((q) => [q.id, q])).values()];
        const available = unique.filter((q) => !seen.has(q.id));
        if (available.length < count && unique.length >= count)
          throw new Error(
            `Only ${available.length} unseen questions match; ${count} requested. Choose fewer questions or broaden your filters. To intentionally reuse questions, reset selection history in Question Bank.`,
          );
        const picked = sampleBank(available, count);
        picked.forEach((q) => seen.add(q.id));
        return picked;
      });
      // Do not serve a new selection if its reservation cannot be persisted.
      storage.setItem(key, JSON.stringify([...seen]));
      return selected;
    },
    reset() {
      storage.setItem(key, "[]");
    },
  };
}

let questionHistoryUser: string | null = null;
export function setQuestionHistoryUser(userId: string | null) {
  questionHistoryUser = userId;
}
function questionRotation() {
  if (!questionHistoryUser) throw new Error("Sign in before selecting practice questions.");
  return createQuestionRotation(globalThis.localStorage, questionHistoryUser);
}
export function drawBankQuestions(questions: BankQuestion[], count: number) {
  return questionRotation().draw([{ questions, count }])[0];
}
export function unseenBankQuestions(questions: BankQuestion[]) {
  return questionRotation().unseen(questions);
}
export function resetQuestionHistory() {
  questionRotation().reset();
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
    questions: drawBankQuestions(
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
  const selected = questionRotation().draw(
    data.sections.map((section) => ({
      questions: filterBank(bank, { subject: section.name, mcqOnly: true }),
      count: section.questions,
    })),
  );
  return {
    sections: data.sections.map((section, index) => ({
      name: section.name,
      questions: selected[index].map(toQuizQuestion),
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
