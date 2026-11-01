import { structuredTopicMatches, validateQuizRequest } from "./quiz-search.ts";
import {
  validateGeneratedQuestions,
  validateSelectedIds,
  validateTopicDecision,
  INVALID_QUIZ_TOPIC,
} from "../../supabase/functions/_shared/quiz-validation.ts";
import type { BankQuestion } from "./question-bank.ts";
import type { QuizQuestion } from "./storage.ts";

type SelectionRequest = {
  topic: string;
  count: number;
  difficulty?: string;
  examName?: string;
  excludeQuestions?: string[];
};
type SelectionDependencies = {
  load: () => Promise<BankQuestion[]>;
  reserve: (questions: BankQuestion[], count: number) => Promise<BankQuestion[]>;
  convert: (question: BankQuestion) => QuizQuestion;
  select: (
    data: SelectionRequest & { candidates: BankQuestion[] },
  ) => Promise<{ valid: boolean; topic: string; ids: string[] }>;
  generate: (data: SelectionRequest) => Promise<unknown>;
  progress?: (message: string) => void;
};

/** Fall back only for content shortages; transport, auth and malformed results remain errors. */
export async function selectQuiz(data: SelectionRequest, deps: SelectionDependencies) {
  validateQuizRequest(data.topic, data.count);
  deps.progress?.("Searching the question bank…");
  const bank = (await deps.load()).filter(
    (q) =>
      q.question_type === "mcq" &&
      (!data.difficulty || data.difficulty === "any" || q.difficulty === data.difficulty),
  );
  const matches = structuredTopicMatches(bank, data.topic);
  const chosen = matches.length ? await deps.reserve(matches, data.count) : [];
  const questions: QuizQuestion[] = chosen.map(deps.convert);
  if (questions.length === data.count) return { questions };
  // A blank topic is mixed bank practice; don't invent a topic to fill an exhausted bank.
  if (!data.topic.trim())
    throw new Error(
      `Only ${questions.length} unseen bank questions are available with these filters. Choose fewer questions, broaden the difficulty, or reset history in Question Bank.`,
    );
  deps.progress?.("Finding related bank questions with AI…");
  const candidates = bank.filter((q) => !chosen.some((picked) => picked.id === q.id));
  const selection = await deps.select({ ...data, candidates });
  const decision = validateTopicDecision(selection);
  if (!decision.valid) throw new Error(INVALID_QUIZ_TOPIC);
  const ids = new Set(validateSelectedIds(selection, candidates));
  const related = candidates.filter((q) => ids.has(q.id));
  if (related.length)
    questions.push(
      ...(await deps.reserve(related, data.count - questions.length)).map(deps.convert),
    );
  if (questions.length < data.count) {
    deps.progress?.("Creating additional questions for this topic…");
    const missing = data.count - questions.length;
    const result = await deps.generate({
      ...data,
      topic: decision.topic,
      count: missing,
      excludeQuestions: questions.map((q) => q.question),
    });
    questions.push(...validateGeneratedQuestions(result, missing));
  }
  if (new Set(questions.map((q) => q.question.trim().toLowerCase())).size !== questions.length)
    throw new Error("The quiz contained duplicate questions. Please try again.");
  return { questions };
}
