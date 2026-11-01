import type { BankQuestion } from "./question-bank.ts";
import type { ReviewCard } from "./storage.ts";

export type CoachActivity = {
  windowSeconds: number;
  pointerSamples: number;
  pointerDistance: number;
  directionChanges: number;
  clicks: number;
  keyPresses: number;
  scrolls: number;
  tabDepartures: number;
  secondsWithoutProgress: number;
};
type Bucket = Omit<CoachActivity, "windowSeconds" | "secondsWithoutProgress"> & { time: number };

/** A rolling minute of counts. Pointer coordinates are only used for the next delta, never exported. */
export function createActivityMeter() {
  let buckets: Bucket[] = [];
  let previous: { x: number; y: number; at: number; dx: number; dy: number } | null = null;
  const bucket = (now: number) => {
    buckets = buckets.filter((b) => now - b.time < 60_000);
    const time = Math.floor(now / 10_000) * 10_000;
    let current = buckets.find((b) => b.time === time);
    if (!current) {
      current = {
        time,
        pointerSamples: 0,
        pointerDistance: 0,
        directionChanges: 0,
        clicks: 0,
        keyPresses: 0,
        scrolls: 0,
        tabDepartures: 0,
      };
      buckets.push(current);
    }
    return current;
  };
  return {
    count(kind: "clicks" | "keyPresses" | "scrolls" | "tabDepartures", now: number) {
      bucket(now)[kind]++;
    },
    pointer(x: number, y: number, now: number) {
      if (previous && now - previous.at < 150) return;
      const b = bucket(now);
      b.pointerSamples++;
      if (previous && now - previous.at < 2_000) {
        const dx = x - previous.x,
          dy = y - previous.y;
        const distance = Math.hypot(dx, dy),
          previousDistance = Math.hypot(previous.dx, previous.dy);
        b.pointerDistance += Math.min(100, distance);
        if (
          distance > 8 &&
          previousDistance > 8 &&
          dx * previous.dx + dy * previous.dy < -0.5 * distance * previousDistance
        )
          b.directionChanges++;
        previous = { x, y, at: now, dx, dy };
      } else previous = { x, y, at: now, dx: 0, dy: 0 };
    },
    snapshot(now: number, lastProgress: number): CoachActivity {
      bucket(now);
      return buckets.reduce(
        (sum, b) => ({
          ...sum,
          pointerSamples: sum.pointerSamples + b.pointerSamples,
          pointerDistance: Math.round(sum.pointerDistance + b.pointerDistance),
          directionChanges: sum.directionChanges + b.directionChanges,
          clicks: sum.clicks + b.clicks,
          keyPresses: sum.keyPresses + b.keyPresses,
          scrolls: sum.scrolls + b.scrolls,
          tabDepartures: sum.tabDepartures + b.tabDepartures,
        }),
        {
          windowSeconds: 60,
          pointerSamples: 0,
          pointerDistance: 0,
          directionChanges: 0,
          clicks: 0,
          keyPresses: 0,
          scrolls: 0,
          tabDepartures: 0,
          secondsWithoutProgress: Math.max(0, Math.floor((now - lastProgress) / 1000)),
        },
      );
    },
  };
}

export function possibleDistraction(activity: CoachActivity | null) {
  if (!activity || activity.secondsWithoutProgress < 60 || activity.keyPresses > 10) return false;
  return (
    (activity.pointerSamples >= 50 &&
      activity.pointerDistance >= 2_000 &&
      activity.directionChanges >= 12) ||
    activity.clicks >= 18 ||
    activity.tabDepartures >= 3
  );
}

export function canCoachNow(
  visible: boolean,
  focused: boolean,
  lastInteraction: number,
  now: number,
  paused: boolean,
) {
  return visible && focused && !paused && now - lastInteraction < 90_000;
}

/** Only send the material currently visible to the learner. Unchecked answer keys stay out. */
export function coachMaterial(
  stage: string,
  card: ReviewCard | undefined,
  revealed: boolean,
  question: BankQuestion | undefined,
  checked: boolean,
  answer: number | null,
) {
  if (stage === "review" && card)
    return {
      question: card.question.slice(0, 4000),
      topic: card.topic,
      ...(revealed
        ? { answer: card.answer.slice(0, 3000), explanation: card.explanation?.slice(0, 3000) }
        : {}),
    };
  if (stage === "practice" && question)
    return {
      question: question.question.slice(0, 4000),
      topic: question.topic,
      subject: question.subject,
      options: question.options.map((o) => o.slice(0, 1500)),
      ...(checked
        ? {
            selectedAnswer: answer,
            correctAnswer: question.correct_options[0],
            explanation: question.explanation?.slice(0, 3000),
          }
        : {}),
    };
  return null;
}

export type CoachSnapshot = {
  stage: string;
  nextAction: string;
  budgetMinutes: number;
  remainingSeconds: number;
  reviewed: number;
  recalled: number;
  totalCards: number;
  questionNumber: number;
  totalQuestions: number;
  answered: number;
  correct: number;
  topicResults: ReturnType<typeof coachTopicResults>;
  weakTopics: { subject: string; topic: string; accuracy: number }[];
  lastRating: number | null;
  material: ReturnType<typeof coachMaterial>;
  task: string | null;
  taskDone: boolean;
  comparison: { before: number; after: number; count: number } | null;
};

export function coachTopicResults(questions: BankQuestion[], answers: number[]) {
  const topics = new Map<
    string,
    { subject: string; topic: string; attempted: number; correct: number }
  >();
  questions.slice(0, answers.length).forEach((q, i) => {
    const key = `${q.subject}::${q.topic}`;
    const topic = topics.get(key) ?? {
      subject: q.subject,
      topic: q.topic || q.subject,
      attempted: 0,
      correct: 0,
    };
    topic.attempted++;
    if (answers[i] === q.correct_options[0]) topic.correct++;
    topics.set(key, topic);
  });
  return [...topics.values()];
}
