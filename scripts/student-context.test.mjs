import test from "node:test";
import assert from "node:assert/strict";
import {
  loadStudentContext,
  summarizeStudentRows,
} from "../supabase/functions/_shared/student-context.ts";

test("snapshot scopes every data source to authenticated student and reports failed sections", async () => {
  const calls = [];
  const client = {
    from(table) {
      const call = { table };
      calls.push(call);
      const chain = {
        select(columns) {
          call.columns = columns;
          return chain;
        },
        eq(key, value) {
          call.filter = [key, value];
          return chain;
        },
        order() {
          return chain;
        },
        gte() {
          return chain;
        },
        limit() {
          return chain;
        },
        abortSignal() {
          return Promise.resolve(
            table === "notes"
              ? { error: new Error("offline") }
              : {
                  count: 1,
                  data:
                    table === "user_profiles"
                      ? [{ display_name: "Ada", exam_name: "CBSE Class 10" }]
                      : [],
                },
          );
        },
      };
      return chain;
    },
  };
  const context = await loadStudentContext(client, "student-123");
  assert.equal(calls.length, 11);
  for (const call of calls) {
    assert.deepEqual(call.filter, ["user_id", "student-123"]);
    assert.notEqual(call.columns, "*");
  }
  assert.match(context, /Ada/);
  assert.match(context, /Saved notes: unavailable/);
  assert.match(context, /not mastery/);
});

test("large learning objects are summarized without attachments or test answer keys", () => {
  assert.deepEqual(
    summarizeStudentRows("quizzes", [
      { topic: "Atoms", score: 2, questions: [{ answerIndex: 1 }, {}] },
    ]),
    [{ topic: "Atoms", score: 2, questionCount: 2 }],
  );
  const chat = summarizeStudentRows("chat_sessions", [
    {
      title: "Help",
      messages: [{ role: "user", content: "x".repeat(1000), imageUrl: "data:secret" }],
    },
  ]);
  assert.equal(chat[0].recentMessages[0].content.length, 600);
  assert.doesNotMatch(JSON.stringify(chat), /data:secret/);
  const mock = summarizeStudentRows("mock_tests", [
    {
      sections: [{ name: "Physics", questions: [{ topic: "Forces", answerIndex: 2 }] }],
      answers: { a: 0, b: null },
    },
  ]);
  assert.equal(mock[0].answeredCount, 1);
  assert.doesNotMatch(JSON.stringify(mock), /answerIndex/);
});
