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
export function hasImportedQuestionBank(examId = "") {
  return ["jee", "jee-main", "jee-advanced", "neet"].includes(examId);
}
export function loadQuestionBank(examId: string): Promise<BankQuestion[]> {
  if (examId === "jee")
    return Promise.all([loadQuestionBank("jee-main"), loadQuestionBank("jee-advanced")]).then(
      (banks) => banks.flat(),
    );
  if (!hasImportedQuestionBank(examId)) return Promise.resolve([]);
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

export type QuestionHistoryClient = {
  reserve: (
    groups: { ids: string[]; count: number; allow_partial: boolean }[],
    legacyIds: string[],
  ) => Promise<string[][]>;
  reset: () => Promise<void>;
};

let questionHistoryUser: string | null = null;
let historyClient: QuestionHistoryClient | null = null;
let accountVersion = 0;
export function setQuestionHistoryUser(
  userId: string | null,
  client: QuestionHistoryClient | null = null,
) {
  if (questionHistoryUser !== userId) accountVersion++;
  questionHistoryUser = userId;
  historyClient = client;
}
function accountHistory() {
  if (!questionHistoryUser || !historyClient)
    throw new Error("Sign in before selecting practice questions.");
  return { userId: questionHistoryUser, client: historyClient, version: accountVersion };
}
function legacyQuestionIds(userId: string): string[] {
  try {
    const parsed: unknown = JSON.parse(
      globalThis.localStorage.getItem(`aceprep:question-history:v1:${userId}`) || "[]",
    );
    return Array.isArray(parsed)
      ? parsed
          .filter((id): id is string => typeof id === "string" && id.length <= 200)
          .slice(0, 20000)
      : [];
  } catch {
    return [];
  }
}
function removeLegacyHistory(userId: string) {
  try {
    globalThis.localStorage.removeItem(`aceprep:question-history:v1:${userId}`);
  } catch {
    /* Cloud history remains authoritative. */
  }
}
async function drawBankGroups(
  groups: { questions: BankQuestion[]; count: number; allowPartial?: boolean }[],
) {
  const account = accountHistory();
  const requests = groups.map(({ questions, count, allowPartial }) => {
    if (!Number.isInteger(count) || count < 1 || count > 100)
      throw new Error("Choose between 1 and 100 whole questions.");
    return { ids: [...new Set(questions.map((q) => q.id))], count, allow_partial: !!allowPartial };
  });
  // One server transaction reserves every section; no local/offline fallback.
  const selected = await account.client.reserve(requests, legacyQuestionIds(account.userId));
  if (account.version !== accountVersion)
    throw new Error("Your account changed. Please start the attempt again.");
  const seen = new Set<string>();
  if (!Array.isArray(selected) || selected.length !== groups.length)
    throw new Error("Invalid question reservation response.");
  const result = selected.map((ids, index) => {
    const candidates = new Map(groups[index].questions.map((q) => [q.id, q]));
    if (
      !Array.isArray(ids) ||
      ids.length > groups[index].count ||
      (!groups[index].allowPartial && ids.length !== groups[index].count)
    )
      throw new Error("Incomplete question reservation response.");
    return ids.map((id) => {
      const q = candidates.get(id);
      if (!q || seen.has(id)) throw new Error("Invalid question reservation response.");
      seen.add(id);
      return q;
    });
  });
  removeLegacyHistory(account.userId);
  return result;
}
export async function drawBankQuestions(
  questions: BankQuestion[],
  count: number,
  allowPartial = false,
) {
  return (await drawBankGroups([{ questions, count, allowPartial }]))[0];
}
export async function resetQuestionHistory() {
  const account = accountHistory();
  await account.client.reset();
  removeLegacyHistory(account.userId);
}
export function examIdFromName(name = "") {
  if (/neet/i.test(name)) return "neet";
  if (/upsc|civil services/i.test(name)) return "upsc-prelims";
  if (/\bsat\b/i.test(name)) return "sat";
  if (/\bgre\b|graduate record/i.test(name)) return "gre";
  if (/mixed/i.test(name) && /jee/i.test(name)) return "jee";
  if (/jee.*adv|joint entrance.*advanced/i.test(name)) return "jee-advanced";
  return /jee|joint entrance.*main/i.test(name) ? "jee-main" : "";
}

function requireImportedBank(examId: string) {
  if (!hasImportedQuestionBank(examId))
    throw new Error(
      "In-app practice questions are not imported for this exam yet. Open Question Bank for publisher study materials, official practice and previous-year papers.",
    );
}

export function toQuizQuestion(q: BankQuestion) {
  if (q.question_type !== "mcq")
    throw new Error("This question type needs the full question-bank practice mode.");
  return {
    question: q.question,
    options: q.options,
    answerIndex: q.correct_options[0],
    explanation: q.explanation || `Answer key: ${q.answer}.`,
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
  const examId = examIdFromName(data.examName || "JEE Main");
  requireImportedBank(examId);
  const all = await loadQuestionBank(examId);
  return {
    questions: (
      await drawBankQuestions(
        filterBank(all, { search: data.topic, difficulty: data.difficulty, mcqOnly: true }),
        data.count,
      )
    ).map(toQuizQuestion),
  };
}

export async function bankMock(data: {
  examName: string;
  sections: { name: string; questions: number }[];
}) {
  const examId = examIdFromName(data.examName);
  requireImportedBank(examId);
  const bank = await loadQuestionBank(examId);
  if (!data.sections.length) throw new Error("Select at least one subject for this mock test.");
  const selected = await drawBankGroups(
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
