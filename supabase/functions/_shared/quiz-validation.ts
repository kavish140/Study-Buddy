export const INVALID_QUIZ_TOPIC =
  "That doesn't look like a topic in your exam syllabus. Enter a topic such as Chemical Bonding or Kinematics.";

export function validateTopicDecision(value: unknown): { valid: boolean; topic: string } {
  const result = value as { valid?: unknown; topic?: unknown } | null;
  if (
    !result ||
    typeof result.valid !== "boolean" ||
    typeof result.topic !== "string" ||
    result.topic.length > 200 ||
    (result.valid && !result.topic.trim())
  )
    throw new Error("The AI could not validate this topic. Please try a clearer topic name.");
  return { valid: result.valid, topic: result.topic.trim() };
}

export function validateSelectedIds(value: unknown, candidates: { id: string }[]): string[] {
  const ids = (value as { ids?: unknown } | null)?.ids;
  const allowed = new Set(candidates.map((q) => q.id));
  if (
    !Array.isArray(ids) ||
    ids.length > candidates.length ||
    !ids.every((id) => typeof id === "string" && allowed.has(id))
  )
    throw new Error("The AI returned invalid bank selections. Please try again.");
  return [...new Set(ids as string[])];
}

export function validateGeneratedQuestions(value: unknown, count: number) {
  const questions = (value as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(questions) || questions.length !== count)
    throw new Error("The AI returned an incomplete quiz. Please try again.");
  const seen = new Set<string>();
  return questions.map((question: unknown) => {
    const q = question as Record<string, unknown> | null;
    if (
      !q ||
      typeof q.question !== "string" ||
      q.question.trim().length < 10 ||
      q.question.length > 6000 ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      !q.options.every((o) => typeof o === "string" && o.trim() && o.length <= 2000) ||
      new Set(q.options.map((o: string) => o.trim().toLowerCase())).size !== 4 ||
      !Number.isInteger(q.answerIndex) ||
      (q.answerIndex as number) < 0 ||
      (q.answerIndex as number) > 3 ||
      typeof q.explanation !== "string" ||
      q.explanation.trim().length < 10 ||
      q.explanation.length > 8000
    )
      throw new Error(
        "The AI returned a question with invalid options, answer, or explanation. Please try again.",
      );
    const key = q.question.trim().toLowerCase();
    if (seen.has(key)) throw new Error("The AI returned duplicate questions. Please try again.");
    seen.add(key);
    return {
      question: q.question.trim(),
      options: (q.options as string[]).map((o) => o.trim()),
      answerIndex: q.answerIndex as number,
      explanation: q.explanation.trim(),
      origin: "generated" as const,
    };
  });
}
