import test from "node:test";
import assert from "node:assert/strict";
import {
  canCoachNow,
  coachMaterial,
  coachTopicResults,
  createActivityMeter,
  possibleDistraction,
} from "../src/lib/session-coach.ts";

test("coach recap includes only attempted topic results, without answer keys", () => {
  assert.deepEqual(
    coachTopicResults(
      [
        { subject: "Physics", topic: "Forces", correct_options: [1] },
        { subject: "Physics", topic: "Forces", correct_options: [0] },
        { subject: "Chemistry", topic: "Bonds", correct_options: [0] },
      ],
      [1, 1],
    ),
    [{ subject: "Physics", topic: "Forces", attempted: 2, correct: 1 }],
  );
});

test("coach never receives hidden card or question answers before reveal/check", () => {
  const card = {
    question: "Recall this",
    answer: "secret",
    explanation: "secret reasoning",
    topic: "Physics",
  };
  const question = {
    question: "Try this",
    topic: "Forces",
    subject: "Physics",
    options: ["A", "B"],
    correct_options: [1],
    explanation: "secret reasoning",
  };
  const hiddenCard = coachMaterial("review", card, false, undefined, false, null);
  const hiddenQuestion = coachMaterial("practice", undefined, false, question, false, 1);
  assert.equal("answer" in hiddenCard, false);
  assert.equal("explanation" in hiddenCard, false);
  assert.equal("correctAnswer" in hiddenQuestion, false);
  assert.equal("selectedAnswer" in hiddenQuestion, false);
  assert.equal("explanation" in hiddenQuestion, false);
  assert.equal(coachMaterial("review", card, true, undefined, false, null).answer, "secret");
  assert.equal(coachMaterial("practice", undefined, false, question, true, 0).correctAnswer, 1);
  assert.equal(coachMaterial("summary", card, true, question, true, 0), null);
});

test("coach is silent for hidden, unfocused, paused and idle sessions", () => {
  assert.equal(canCoachNow(true, true, 90_000, 100_000, false), true);
  assert.equal(canCoachNow(false, true, 90_000, 100_000, false), false);
  assert.equal(canCoachNow(true, false, 90_000, 100_000, false), false);
  assert.equal(canCoachNow(true, true, 90_000, 100_000, true), false);
  assert.equal(canCoachNow(true, true, 0, 100_000, false), false);
});

test("activity meter exports counts only, samples pointer movement and expires old buckets", () => {
  const meter = createActivityMeter();
  meter.pointer(0, 0, 1000);
  meter.pointer(100, 0, 1100); // Too soon; no sample.
  meter.pointer(100, 0, 1200);
  meter.pointer(0, 0, 1400);
  meter.count("clicks", 1500);
  meter.count("tabDepartures", 1500);
  const snapshot = meter.snapshot(2000, 1000);
  assert.equal(snapshot.pointerSamples, 3);
  assert.equal(snapshot.pointerDistance, 200);
  assert.equal(snapshot.directionChanges, 1);
  assert.equal(snapshot.clicks, 1);
  assert.equal(snapshot.secondsWithoutProgress, 1);
  assert.deepEqual(
    Object.keys(snapshot).sort(),
    [
      "windowSeconds",
      "pointerSamples",
      "pointerDistance",
      "directionChanges",
      "clicks",
      "keyPresses",
      "scrolls",
      "tabDepartures",
      "secondsWithoutProgress",
    ].sort(),
  );
  assert.equal(meter.snapshot(70_000, 1000).clicks, 0);
  assert.equal(meter.snapshot(70_000, 1000).pointerSamples, 0);
});

test("possible distraction requires sustained lack of progress and multiple movement signals", () => {
  const activity = {
    secondsWithoutProgress: 70,
    pointerSamples: 70,
    pointerDistance: 3000,
    directionChanges: 20,
    keyPresses: 0,
    clicks: 0,
    tabDepartures: 0,
  };
  assert.equal(possibleDistraction(activity), true);
  assert.equal(possibleDistraction({ ...activity, secondsWithoutProgress: 20 }), false);
  assert.equal(possibleDistraction({ ...activity, directionChanges: 0 }), false);
  assert.equal(possibleDistraction({ ...activity, keyPresses: 20 }), false);
  assert.equal(possibleDistraction(null), false);
  assert.equal(possibleDistraction({ ...activity, pointerSamples: 0, clicks: 20 }), true);
});
