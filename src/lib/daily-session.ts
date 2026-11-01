import type { PerformanceLog, PlanItem, ReviewCard, MockTest, SavedQuiz } from "./storage.ts";
import { normalizeTopic, resolveTopic } from "./quiz-search.ts";

const topicKey = (topic: string) => normalizeTopic(resolveTopic(topic)?.[0] ?? topic);

export type SessionMinutes = 15 | 30 | 60;
export type TopicBaseline = { subject: string; topic: string; correct: number; total: number };

export function sessionBudget(minutes: SessionMinutes) {
  return {
    cards: minutes === 15 ? 3 : minutes === 30 ? 5 : 8,
    questions: minutes === 15 ? 3 : minutes === 30 ? 5 : 10,
  };
}

export function dailySessionInputs(
  today: string,
  cards: ReviewCard[],
  plan: PlanItem[],
  logs: PerformanceLog[],
  mocks: MockTest[],
  quizzes: SavedQuiz[],
) {
  const topics = new Map<string, TopicBaseline>();
  const add = (subject: string, topic: string, correct: number, total: number) => {
    if (!total || !topic) return;
    const key = `${subject.toLowerCase()}::${topicKey(topic)}`;
    const old = topics.get(key);
    topics.set(key, {
      subject,
      topic,
      correct: (old?.correct ?? 0) + correct,
      total: (old?.total ?? 0) + total,
    });
  };
  // Performance logs are the latest topic snapshot; use other history only where absent.
  logs.forEach((l) => add(l.subject, l.topic, l.correct_count, l.question_count));
  const logged = new Set(topics.keys());
  mocks
    .filter((m) => m.status === "completed")
    .forEach((m) =>
      m.sections.forEach((s) =>
        s.questions.forEach((q) => {
          if (!logged.has(`${s.name.toLowerCase()}::${topicKey(q.topic)}`))
            add(s.name, q.topic, m.answers[q.id] === q.answerIndex ? 1 : 0, 1);
        }),
      ),
    );
  const coveredTopics = new Set([...topics.values()].map((t) => topicKey(t.topic)));
  quizzes
    .filter((q) => typeof q.score === "number" && q.topic !== "Daily session")
    .forEach((q) => {
      if (!coveredTopics.has(topicKey(q.topic))) add("", q.topic, q.score!, q.questions.length);
    });
  return {
    cards: cards
      .filter((c) => c.next_review <= today)
      .sort((a, b) => a.next_review.localeCompare(b.next_review)),
    task:
      plan
        .filter((p) => !p.done && p.date <= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null,
    baseline: [...topics.values()],
    weakTopics: [...topics.values()]
      .filter((t) => t.correct / t.total < 0.7)
      .sort((a, b) => a.correct / a.total - b.correct / b.total),
  };
}

export function accuracyComparison(
  previous: TopicBaseline[],
  results: { subject: string; topic: string; correct: boolean }[],
) {
  let oldCorrect = 0,
    oldTotal = 0,
    correct = 0,
    total = 0;
  for (const baseline of previous) {
    const matching = results.filter(
      (r) =>
        (!baseline.subject || r.subject === baseline.subject) &&
        topicKey(r.topic) === topicKey(baseline.topic),
    );
    if (!matching.length) continue;
    // Weight the previous rate by this session's question mix for a like-for-like comparison.
    oldCorrect += (baseline.correct / baseline.total) * matching.length;
    oldTotal += matching.length;
    correct += matching.filter((r) => r.correct).length;
    total += matching.length;
  }
  return total
    ? {
        before: Math.round((oldCorrect / oldTotal) * 100),
        after: Math.round((correct / total) * 100),
        count: total,
      }
    : null;
}
